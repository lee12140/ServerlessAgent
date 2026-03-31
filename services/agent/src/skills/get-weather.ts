/**
 * Skill: Get Weather
 * Fetches current weather and forecast via OpenWeatherMap API.
 * Requires env var: WEATHER_API_KEY
 */

export const getWeatherDefinition = {
  name: 'get_weather',
  description: "Get the current weather and short forecast for a city. Use this when the user asks about the weather, temperature, or conditions in a location.",
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "City name (e.g., 'Berlin', 'London', 'New York')",
        },
      },
      required: ['city'],
    },
  },
};

interface WeatherInput {
  city: string;
}

interface OWMCurrentResponse {
  name: string;
  sys: { country: string };
  main: { temp: number; feels_like: number; humidity: number };
  weather: { description: string }[];
  wind: { speed: number };
}

interface OWMForecastItem {
  dt_txt: string;
  main: { temp_min: number; temp_max: number };
  weather: { description: string }[];
}

interface OWMForecastResponse {
  list: OWMForecastItem[];
}

export async function getWeather(input: WeatherInput): Promise<string> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return 'Cannot fetch weather: WEATHER_API_KEY environment variable is not set.';
  }

  const { city } = input;

  try {
    const TIMEOUT_MS = 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`,
        { signal: controller.signal }
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&cnt=8`,
        { signal: controller.signal }
      ),
    ]);
    clearTimeout(timer);

    if (!currentRes.ok) {
      if (currentRes.status === 404) return `City "${city}" not found. Please check the spelling.`;
      return `Weather API error: ${currentRes.status} ${currentRes.statusText}`;
    }

    const current = await currentRes.json() as OWMCurrentResponse;
    const forecast = forecastRes.ok ? await forecastRes.json() as OWMForecastResponse : null;

    const lines = [
      `Weather in ${current.name}, ${current.sys.country}:`,
      `• Condition: ${current.weather[0]?.description ?? 'N/A'}`,
      `• Temperature: ${Math.round(current.main.temp)}°C (feels like ${Math.round(current.main.feels_like)}°C)`,
      `• Humidity: ${current.main.humidity}%`,
      `• Wind: ${current.wind.speed} m/s`,
    ];

    if (forecast && forecast.list.length > 0) {
      lines.push('\n24h Forecast (3h intervals):');
      forecast.list.slice(0, 4).forEach(item => {
        lines.push(
          `• ${item.dt_txt} — ${item.weather[0]?.description ?? ''}, ${Math.round(item.main.temp_min)}–${Math.round(item.main.temp_max)}°C`
        );
      });
    }

    return lines.join('\n');
  } catch (error: any) {
    console.error('[Weather ERROR]:', error.message);
    return `Failed to fetch weather: ${error.message}`;
  }
}
