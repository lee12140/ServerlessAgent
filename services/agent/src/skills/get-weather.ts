import type { Skill } from './types.js';

interface OWMCurrent {
  name: string;
  sys: { country: string };
  main: { temp: number; feels_like: number; humidity: number };
  weather: { description: string }[];
  wind: { speed: number };
}

interface OWMForecast {
  list: { dt_txt: string; main: { temp_min: number; temp_max: number }; weather: { description: string }[] }[];
}

async function getWeather(input: { city: string }): Promise<string> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) return 'Cannot fetch weather: WEATHER_API_KEY is not set.';

  const { city } = input;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`, { signal: controller.signal }),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&cnt=8`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);

    if (!currentRes.ok) {
      return currentRes.status === 404 ? `City "${city}" not found.` : `Weather API error: ${currentRes.status}`;
    }

    const current = await currentRes.json() as OWMCurrent;
    const forecast = forecastRes.ok ? await forecastRes.json() as OWMForecast : null;

    const lines = [
      `Weather in ${current.name}, ${current.sys.country}:`,
      `• Condition: ${current.weather[0]?.description ?? 'N/A'}`,
      `• Temperature: ${Math.round(current.main.temp)}°C (feels like ${Math.round(current.main.feels_like)}°C)`,
      `• Humidity: ${current.main.humidity}%`,
      `• Wind: ${current.wind.speed} m/s`,
    ];

    if (forecast?.list.length) {
      lines.push('\n24h Forecast:');
      forecast.list.slice(0, 4).forEach(item => {
        lines.push(`• ${item.dt_txt} — ${item.weather[0]?.description ?? ''}, ${Math.round(item.main.temp_min)}–${Math.round(item.main.temp_max)}°C`);
      });
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error('[Weather ERROR]:', error.message);
    return `Failed to fetch weather: ${error.message}`;
  }
}

export const getWeatherSkill: Skill = {
  definition: {
    name: 'get_weather',
    description: "Get current weather and short forecast for a city.",
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          city: { type: 'string', description: "City name (e.g., 'Berlin', 'London')" },
        },
        required: ['city'],
      },
    },
  },
  execute: (input) => getWeather(input as { city: string }),
};
