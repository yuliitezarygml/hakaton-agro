package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ══════════════════════════════════════════════════════════
//  Модели данных
// ══════════════════════════════════════════════════════════

type ZoneData struct {
	Zone     int     `json:"zone"`
	Temp     float64 `json:"temp"`
	Humidity float64 `json:"humidity"`
	Online   bool    `json:"online"`
}

type SensorPayload struct {
	Zones        []ZoneData `json:"zones"`
	SoilMoisture int        `json:"soil_moisture"`
	Rain         bool       `json:"rain"`
	Timestamp    int64      `json:"timestamp"`
	ReceivedAt   time.Time  `json:"received_at"`
}

// ══════════════════════════════════════════════════════════
//  Красивый лог-префикс
// ══════════════════════════════════════════════════════════

const (
	green  = "\033[32m"
	yellow = "\033[33m"
	cyan   = "\033[36m"
	red    = "\033[31m"
	reset  = "\033[0m"
	bold   = "\033[1m"
)

func logOK(format string, a ...any) {
	prefix := fmt.Sprintf("%s[%s]%s %s✓%s ", cyan, time.Now().Format("15:04:05"), reset, green, reset)
	log.Printf(prefix+format, a...)
}

func logIN(format string, a ...any) {
	prefix := fmt.Sprintf("%s[%s]%s %s↓ ESP32%s ", cyan, time.Now().Format("15:04:05"), reset, yellow, reset)
	log.Printf(prefix+format, a...)
}

func logOUT(format string, a ...any) {
	prefix := fmt.Sprintf("%s[%s]%s %s↑ WEB%s   ", cyan, time.Now().Format("15:04:05"), reset, cyan, reset)
	log.Printf(prefix+format, a...)
}

func logWS(format string, a ...any) {
	prefix := fmt.Sprintf("%s[%s]%s %s⇆ WS%s    ", cyan, time.Now().Format("15:04:05"), reset, bold, reset)
	log.Printf(prefix+format, a...)
}

func logErr(format string, a ...any) {
	prefix := fmt.Sprintf("%s[%s]%s %s✗%s ", cyan, time.Now().Format("15:04:05"), reset, red, reset)
	log.Printf(prefix+format, a...)
}

// ══════════════════════════════════════════════════════════
//  Сервер
// ══════════════════════════════════════════════════════════

const maxHistory = 360  // ~1 час при 10с интервале
const historyFile = "history.json"

type Server struct {
	mu       sync.RWMutex
	latest   *SensorPayload
	history  []SensorPayload // кольцевой буфер истории
	clients  map[*websocket.Conn]string // conn → remote addr
	upgrader websocket.Upgrader

	totalReceived int
	totalSent     int
}

// ── Загрузка истории из JSON при старте ───────────────────────────
func loadHistory() []SensorPayload {
	data, err := os.ReadFile(historyFile)
	if err != nil {
		logOK("Файл %s не найден — начинаем с пустой истории", historyFile)
		return make([]SensorPayload, 0, maxHistory)
	}
	var h []SensorPayload
	if err := json.Unmarshal(data, &h); err != nil {
		logErr("Ошибка чтения %s: %v — начинаем с пустой", historyFile, err)
		return make([]SensorPayload, 0, maxHistory)
	}
	// Обрезаем до maxHistory
	if len(h) > maxHistory {
		h = h[len(h)-maxHistory:]
	}
	logOK("Загружено %d записей из %s", len(h), historyFile)
	return h
}

// ── Сохранение истории в JSON ────────────────────────────────────
func (s *Server) saveHistory() {
	s.mu.RLock()
	data, err := json.Marshal(s.history)
	s.mu.RUnlock()
	if err != nil {
		logErr("Ошибка сериализации истории: %v", err)
		return
	}
	if err := os.WriteFile(historyFile, data, 0644); err != nil {
		logErr("Ошибка записи %s: %v", historyFile, err)
	}
}

func NewServer() *Server {
	h := loadHistory()
	srv := &Server{
		history: h,
		clients: make(map[*websocket.Conn]string),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
	// Восстанавливаем latest из последней записи
	if len(h) > 0 {
		last := h[len(h)-1]
		srv.latest = &last
	}
	return srv
}

// ──────────────────────────────────────────────────────────
// POST /api/data  ← ESP32 шлёт сюда данные каждые 10 сек
// ──────────────────────────────────────────────────────────
func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p SensorPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		logErr("Неверный JSON от %s: %v", r.RemoteAddr, err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	p.ReceivedAt = time.Now()

	// ── Логируем входящие данные + сохраняем в историю ────
	s.mu.Lock()
	s.latest = &p
	s.totalReceived++
	n := s.totalReceived
	clients := len(s.clients)
	// Добавляем в историю (кольцевой буфер)
	if len(s.history) >= maxHistory {
		s.history = s.history[1:]
	}
	s.history = append(s.history, p)
	s.mu.Unlock()

	// Сохраняем в файл (в фоне чтобы не блокировать ответ)
	go s.saveHistory()

	logIN("Пакет #%d от %s", n, r.RemoteAddr)
	for _, z := range p.Zones {
		status := "✓"
		if !z.Online {
			status = "✗ нет датчика"
		}
		log.Printf("         Зона %d: %+.1f°C  %.0f%%  %s",
			z.Zone, z.Temp, z.Humidity, status)
	}
	log.Printf("         Почва: %d%%   Дождь: %v   uptime: %ds",
		p.SoilMoisture, p.Rain, p.Timestamp/1000)

	// ── Рассылаем всем WebSocket клиентам ─────────────────
	pushed := s.broadcast(&p)
	logWS("Push → %d/%d клиентов", pushed, clients)

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","packet":%d}`, n)
}

// ──────────────────────────────────────────────────────────
// GET /api/sensors  ← браузер запрашивает текущие данные
// ──────────────────────────────────────────────────────────
func (s *Server) handleSensors(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	s.mu.Lock()
	p := s.latest
	s.totalSent++
	sent := s.totalSent
	s.mu.Unlock()

	if p == nil {
		// Демо-данные если ESP32 ещё не прислал ничего
		p = &SensorPayload{
			Zones: []ZoneData{
				{Zone: 1, Temp: 22.5, Humidity: 65, Online: true},
				{Zone: 2, Temp: 21.0, Humidity: 70, Online: true},
				{Zone: 3, Temp: -1.5, Humidity: 85, Online: true},
				{Zone: 4, Temp: 24.0, Humidity: 60, Online: true},
			},
			SoilMoisture: 48,
			Rain:         false,
			ReceivedAt:   time.Now(),
		}
		logOUT("REST #%d %s → демо-данные (ESP32 ещё не подключён)", sent, r.RemoteAddr)
	} else {
		logOUT("REST #%d %s → реальные данные (получены в %s)",
			sent, r.RemoteAddr, p.ReceivedAt.Format("15:04:05"))
	}

	json.NewEncoder(w).Encode(p)
}

// ──────────────────────────────────────────────────────────
// GET /api/history  ← браузер запрашивает историю для графиков
// ──────────────────────────────────────────────────────────
func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	s.mu.RLock()
	h := make([]SensorPayload, len(s.history))
	copy(h, s.history)
	s.mu.RUnlock()

	logOUT("HISTORY %s → %d записей", r.RemoteAddr, len(h))
	json.NewEncoder(w).Encode(h)
}

// ──────────────────────────────────────────────────────────
// GET /ws  ← WebSocket для live-обновлений в браузере
// ──────────────────────────────────────────────────────────
func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		logErr("WS upgrade: %v", err)
		return
	}
	addr := r.RemoteAddr

	s.mu.Lock()
	s.clients[conn] = addr
	total := len(s.clients)
	p := s.latest
	s.mu.Unlock()

	logWS("Клиент подключился %s  (всего: %d)", addr, total)

	// Сразу шлём текущие данные
	if p != nil {
		if err := conn.WriteJSON(p); err == nil {
			logWS("Отправлены начальные данные → %s", addr)
		}
	}

	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		remaining := len(s.clients)
		s.mu.Unlock()
		conn.Close()
		logWS("Клиент отключился %s  (осталось: %d)", addr, remaining)
	}()

	// Держим соединение живым
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}

// ──────────────────────────────────────────────────────────
// broadcast — рассылает всем WS клиентам
// ──────────────────────────────────────────────────────────
func (s *Server) broadcast(p *SensorPayload) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	ok := 0
	for conn, addr := range s.clients {
		if err := conn.WriteJSON(p); err != nil {
			logErr("WS write → %s: %v", addr, err)
			conn.Close()
			delete(s.clients, conn)
		} else {
			ok++
		}
	}
	return ok
}

// ──────────────────────────────────────────────────────────
// CORS middleware
// ──────────────────────────────────────────────────────────
func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

// ══════════════════════════════════════════════════════════
//  main
// ══════════════════════════════════════════════════════════

func main() {
	log.SetFlags(0) // убираем стандартный префикс — у нас свой

	sep := strings.Repeat("═", 44)
	fmt.Println(bold + sep + reset)
	fmt.Println(bold + "  AgriMap Go Backend  v1.0" + reset)
	fmt.Println(bold + sep + reset)
	fmt.Printf("  %s↓ POST /api/data%s     ← ESP32 (каждые 10с)\n", yellow, reset)
	fmt.Printf("  %s↑ GET  /api/sensors%s  → Next.js (REST)\n", cyan, reset)
	fmt.Printf("  %s⇆ GET  /ws%s           → браузер (WebSocket)\n", bold, reset)
	fmt.Println(bold + sep + reset)
	fmt.Println()

	srv := NewServer()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/data",    cors(srv.handleIngest))
	mux.HandleFunc("/api/sensors", cors(srv.handleSensors))
	mux.HandleFunc("/api/history", cors(srv.handleHistory))
	mux.HandleFunc("/ws",          srv.handleWS)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintf(w, "AgriMap Backend v1.0\nEndpoints:\n  POST /api/data\n  GET  /api/sensors\n  WS   /ws\n")
	})

	addr := ":8080"
	logOK("Сервер запущен на http://localhost%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		logErr("Сервер упал: %v", err)
	}
}
