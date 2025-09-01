const { RESTDataSource } = require('apollo-datasource-rest');
const DataLoader = require('dataloader');

class OpenMeteoAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = 'https://api.open-meteo.com/v1/';
    this.geocodingBaseURL = 'https://geocoding-api.open-meteo.com/v1/';
    this.cityLoader = new DataLoader(names => this.batchGetCities(names));
    this.forecastLoader = new DataLoader(keys => this.batchGetForecasts(keys));
  }

  async batchGetCities(names) {
    const results = await Promise.all(
      names.map(async name => {
        const response = await this.get(`search?name=${encodeURIComponent(name)}&count=10&language=en`);
        return response.results || [];
      })
    );
    return results;
  }

  async getCities(name) {
    return this.cityLoader.load(name);
  }

  async batchGetForecasts(keys) {
    const results = await Promise.all(
      keys.map(async ({ latitude, longitude, timezone, days }) => {
        const params = new URLSearchParams({
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max',
          timezone,
          forecast_days: days,
        });
        return this.get(`forecast?${params.toString()}`);
      })
    );
    return results;
  }

  async getForecast(latitude, longitude, timezone, days) {
    return this.forecastLoader.load({ latitude, longitude, timezone, days });
  }
}

module.exports = OpenMeteoAPI;