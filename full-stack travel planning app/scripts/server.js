const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const fs = require('fs');
const OpenMeteoAPI = require('./dataSources');

const typeDefs = fs.readFileSync('./schema.graphql', { encoding: 'utf-8' });

const ACTIVITIES = ['Skiing', 'Surfing', 'Indoor Sightseeing', 'Outdoor Sightseeing'];

const wmoDescriptions = {
  0: 'Sunny', 1: 'Mainly Sunny', 2: 'Partly Cloudy', 3: 'Cloudy',
  45: 'Foggy', 48: 'Rime Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  56: 'Light Freezing Drizzle', 57: 'Freezing Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  66: 'Light Freezing Rain', 67: 'Freezing Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
  80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Light Snow Showers', 86: 'Snow Showers',
  95: 'Thunderstorm', 96: 'Light Thunderstorms With Hail', 99: 'Thunderstorm With Hail'
};

const resolvers = {
  Query: {
    citySuggestions: async (_, { name }, { dataSources }) => {
      const results = await dataSources.openMeteo.getCities(name);
      return results.map(city => ({
        id: city.id,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        country: city.country,
      }));
    },
    weatherForecast: async (_, { latitude, longitude, timezone, days }, { dataSources }) => {
      const data = await dataSources.openMeteo.getForecast(latitude, longitude, timezone, days);
      const dailyData = data.daily;
      return {
        daily: dailyData.time.map((date, index) => ({
          date,
          tempMax: dailyData.temperature_2m_max[index],
          tempMin: dailyData.temperature_2m_min[index],
          weatherCode: dailyData.weather_code[index],
          precipitation: dailyData.precipitation_sum[index],
          windSpeed: dailyData.wind_speed_10m_max[index],
        })),
        units: {
          temp: data.daily_units.temperature_2m_max,
          precipitation: data.daily_units.precipitation_sum,
          windSpeed: data.daily_units.wind_speed_10m_max,
        },
      };
    },
    activityRankings: async (_, { latitude, longitude, timezone, date }, { dataSources }) => {
      const forecast = await dataSources.openMeteo.getForecast(latitude, longitude, timezone, 7);
      const daily = forecast.daily;
      // Default to tomorrow if no date provided
      const targetDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const index = daily.time.findIndex(t => t === targetDate);
      if (index === -1) throw new Error('Date not in forecast range');

      const weather = {
        tempMax: daily.temperature_2m_max[index],
        tempMin: daily.temperature_2m_min[index],
        code: daily.weather_code[index],
        precip: daily.precipitation_sum[index],
        wind: daily.wind_speed_10m_max[index],
      };

      return ACTIVITIES.map(activity => {
        let score = 0;
        let reason = '';

        if (activity === 'Skiing') {
          if (weather.tempMax < 5) score += 40;
          if (weather.tempMin < 0 && weather.precip > 0) score += 30;
          if ([71, 73, 75, 77, 85, 86].includes(weather.code)) score += 20;
          if (weather.wind < 15) score += 10;
          reason = weather.tempMax < 5 ? 'Cold enough for snow' : 'Too warm';
        } else if (activity === 'Surfing') {
          if (weather.tempMax > 15) score += 40;
          if (weather.wind > 10) score += 30;
          if (weather.precip < 1 && ![95, 96, 99].includes(weather.code)) score += 30;
          reason = weather.wind > 10 ? 'Good wind for waves' : 'Calm winds';
        } else if (activity === 'Indoor Sightseeing') {
          if (weather.precip > 2 || [45, 48, 61, 63, 65, 95, 96, 99].includes(weather.code)) score += 80;
          reason = weather.precip > 2 ? 'Poor weather favors indoor activities' : 'Weather is fine for outdoors';
        } else if (activity === 'Outdoor Sightseeing') {
          if (weather.tempMax >= 10 && weather.tempMax <= 25) score += 40;
          if ([0, 1, 2, 3].includes(weather.code)) score += 30;
          if (weather.precip < 1) score += 20;
          if (weather.wind < 10) score += 10;
          reason = weather.tempMax >= 10 && weather.tempMax <= 25 ? 'Mild weather for sightseeing' : 'Uncomfortable temperatures';
        }

        return { activity, score, reason };
      }).sort((a, b) => b.score - a.score);
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

(async () => {
  const { url } = await startStandaloneServer(server, {
    context: async () => ({
      dataSources: {
        openMeteo: new OpenMeteoAPI(),
      },
    }),
    listen: { port: process.env.PORT || 4000 },
  });
  console.log(`Server ready at ${url}`);
})();