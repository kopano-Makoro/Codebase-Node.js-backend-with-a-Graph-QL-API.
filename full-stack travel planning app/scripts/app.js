import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';

const client = new ApolloClient({
  uri: 'https://weather-graphql-xxx.a.run.app/graphql', // Replace with your Cloud Run URL
  cache: new InMemoryCache(),
});

const CITY_SUGGESTIONS = gql`
  query CitySuggestions($name: String!) {
    citySuggestions(name: $name) {
      id
      name
      latitude
      longitude
      country
    }
  }
`;

const WEATHER_AND_ACTIVITIES = gql`
  query WeatherAndActivities($latitude: Float!, $longitude: Float!, $timezone: String, $date: String) {
    weatherForecast(latitude: $latitude, longitude: $longitude, timezone: $timezone, days: 7) {
      daily {
        date
        tempMax
        tempMin
        weatherCode
        precipitation
        windSpeed
      }
      units {
        temp
        precipitation
        windSpeed
      }
    }
    activityRankings(latitude: $latitude, longitude: $longitude, timezone: $timezone, date: $date) {
      activity
      score
      reason
    }
  }
`;

const cityForm = document.querySelector('#cityForm');
const cityInput = document.querySelector('#cityInput');
const citySuggestions = document.querySelector('#citySuggestions');
const dateInput = document.querySelector('#dateInput');
const card = document.querySelector('.card');
const details = document.querySelector('.details');
const forecast = document.querySelector('.forecast');
const activities = document.querySelector('.activities');
const time = document.querySelector('img.time');
const icon = document.querySelector('.icon img');

const wmoIcons = {
  0: '01', 1: '01', 2: '02', 3: '03',
  45: '50', 48: '50', 51: '10', 53: '10', 55: '10',
  56: '13', 57: '13', 61: '10', 63: '10', 65: '10',
  66: '13', 67: '13', 71: '13', 73: '13', 75: '13', 77: '13',
  80: '09', 81: '09', 82: '09', 85: '13', 86: '13',
  95: '11', 96: '11', 99: '11'
};

const updateUI = ({ city, weatherForecast, activityRankings }) => {
  // Update details
  details.innerHTML = `
    <h5 class="my-3">${city.name}, ${city.country}</h5>
    <div class="my-3">${weatherForecast.daily[0].weatherCode in wmoIcons ? `WMO Code ${weatherForecast.daily[0].weatherCode}` : 'Unknown'}</div>
    <div class="display-4 my-4">
      <span>${weatherForecast.daily[0].tempMax}</span>
      <span>${weatherForecast.units.temp}</span>
    </div>
  `;


  const iconSrc = `img/icons/${wmoIcons[weatherForecast.daily[0].weatherCode] || '01'}.svg`;
  icon.setAttribute('src', iconSrc);

  
  const isDay = new Date().getHours() < 18;
  time.setAttribute('src', isDay ? 'img/day.svg' : 'img/night.svg');

 
  forecast.innerHTML = `
    <h6>7-Day Forecast</h6>
    <ul class="list-group">
      ${weatherForecast.daily.map(day => `
        <li class="list-group-item">
          ${day.date}: ${day.tempMin}–${day.tempMax}${weatherForecast.units.temp}, 
          Precip: ${day.precipitation}${weatherForecast.units.precipitation}, 
          Wind: ${day.windSpeed}${weatherForecast.units.windSpeed}
        </li>
      `).join('')}
    </ul>
  `;

 
  activities.innerHTML = `
    <h6>Activity Rankings</h6>
    <ul class="list-group">
      ${activityRankings.map(({ activity, score, reason }) => `
        <li class="list-group-item">
          ${activity}: Score ${score.toFixed(1)}/100 (${reason})
        </li>
      `).join('')}
    </ul>
  `;

  if (card.classList.contains('d-none')) {
    card.classList.remove('d-none');
  }
};

const updateCitySuggestions = async (name) => {
  if (name.length < 2) {
    citySuggestions.innerHTML = '';
    citySuggestions.classList.remove('show');
    return;
  }
  try {
    const { data } = await client.query({
      query: CITY_SUGGESTIONS,
      variables: { name },
    });
    citySuggestions.innerHTML = data.citySuggestions.map(city => `
      <a class="dropdown-item" href="#" data-lat="${city.latitude}" data-lon="${city.longitude}" data-name="${city.name}" data-country="${city.country}">
        ${city.name}, ${city.country}
      </a>
    `).join('');
    citySuggestions.classList.add('show');
  } catch (err) {
    console.error(err);
  }
};

const updateCity = async (latitude, longitude, timezone = 'auto', date, cityName, country) => {
  try {
    const { data } = await client.query({
      query: WEATHER_AND_ACTIVITIES,
      variables: { latitude, longitude, timezone, date },
    });
    updateUI({
      city: { name: cityName, country },
      weatherForecast: data.weatherForecast,
      activityRankings: data.activityRankings,
    });
    localStorage.setItem('location', JSON.stringify({ latitude, longitude, cityName, country }));
  } catch (err) {
    console.error(err);
  }
};

cityInput.addEventListener('input', () => updateCitySuggestions(cityInput.value.trim()));
citySuggestions.addEventListener('click', e => {
  if (e.target.classList.contains('dropdown-item')) {
    e.preventDefault();
    const lat = parseFloat(e.target.dataset.lat);
    const lon = parseFloat(e.target.dataset.lon);
    const name = e.target.dataset.name;
    const country = e.target.dataset.country;
    cityInput.value = `${name}, ${country}`;
    citySuggestions.innerHTML = '';
    citySuggestions.classList.remove('show');
    updateCity(lat, lon, 'auto', dateInput.value, name, country);
  }
});

cityForm.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) {
    updateCitySuggestions(city).then(() => {
      const firstSuggestion = citySuggestions.querySelector('.dropdown-item');
      if (firstSuggestion) {
        const lat = parseFloat(firstSuggestion.dataset.lat);
        const lon = parseFloat(firstSuggestion.dataset.lon);
        const name = firstSuggestion.dataset.name;
        const country = firstSuggestion.dataset.country;
        updateCity(lat, lon, 'auto', dateInput.value, name, country);
      }
    });
    cityForm.reset();
  }
});

if (localStorage.getItem('location')) {
  const { latitude, longitude, cityName, country } = JSON.parse(localStorage.getItem('location'));
  updateCity(latitude, longitude, 'auto', dateInput.value, cityName, country);

}
