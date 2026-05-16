/** @type {import('next').NextConfig} */
const nextConfig = {
  // Разрешаем доступ с IP ESP32 AP и локальной сети
  allowedDevOrigins: [
    '192.168.4.99',
    '10.151.200.245',
    '*.local',
  ],

  async rewrites() {
    return [
      {
        source: '/api/sensors',
        destination: 'http://localhost:8080/api/sensors',
      },
    ];
  },
};

export default nextConfig;
