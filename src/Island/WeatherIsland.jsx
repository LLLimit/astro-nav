/**
 * @author Zywe
 * @version 8.11.0
 */
import { useState, useEffect, useRef } from 'react';
/**
 * 天气数据结构
 * @typedef {Object} WeatherData
 * @property {string} location - 位置名称
 * @property {string} condition - 天气状况
 * @property {string} temperature - 当前温度
 * @property {string} tempRange - 温度范围（最低~最高）
 * @property {string} airQuality - 空气质量
 * @property {string} time - 更新时间（仅时分）
 * @property {string} fullDateTime - 完整日期时间（年月日星期时分）
 * @property {string} icon - 天气图标
 */
const CACHE_DURATION = 3600000; 
const weatherIcons = {
  '晴': '☀️',        
  '多云': '⛅',        
  '阴': '☁️',        
  '小雨': '🌦️',      
  '中雨': '🌧️',      
  '大雨': '🌧️',      
  '暴雨': '⛈️',      
  '雷': '⚡',         
  '雪': '❄️',        
  '雾': '🌫️',       
  '霾': '🌫️',       
  '未知': '🌤️'      
};
/**
 * 处理 Open Meteo API 返回的天气数据
 * @param {Object} data - API返回的原始天气数据
 * @param {number} timestamp - 当前时间戳
 * @param {string} userLocation - 用户地区信息
 * @param {Object} coordinates - 经纬度坐标
 * @returns {Object} 处理后的天气数据对象
 */
function processWeatherData(data, timestamp, userLocation = '', coordinates = null) {
  console.log('处理天气数据');
  const currentTime = new Date();
  const timeString = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const fullDateTime = currentTime.getFullYear() + '年' + 
                    (currentTime.getMonth() + 1) + '月' + 
                    currentTime.getDate() + '日 星期' + 
                    weekDays[currentTime.getDay()] + ' ' + 
                    timeString;
  if (!data || data.error) {
    console.error('天气数据获取失败', data?.error);
    const errorMessage = data && data.reason ? data.reason : '该位置暂不支持';
    return {
      location: userLocation || '未知位置',
      condition: errorMessage,
      temperature: 'N/A',
      tempRange: 'N/A',
      airQuality: 'N/A',
      time: timeString,
      fullDateTime: fullDateTime,
      icon: weatherIcons['未知']
    };
  }
  const current = data.current || {};
  const weatherCode = current.weather_code || 0;
  const temperature = current.temperature_2m !== undefined ? 
    `${Math.round(current.temperature_2m)}°C` : 'N/A';
  let tempRange = 'N/A';
  if (data.daily) {
    const minTemp = data.daily.temperature_2m_min?.[0];
    const maxTemp = data.daily.temperature_2m_max?.[0];
    if (minTemp !== undefined && maxTemp !== undefined) {
      tempRange = `${Math.round(minTemp)}~${Math.round(maxTemp)}°C`;
    }
  }
  let humidity = 'N/A';
  if (data.current && data.current.relative_humidity_2m !== undefined) {
    humidity = `${data.current.relative_humidity_2m}%`;
  }
  let airQuality = 'N/A';
  if (data.current && data.current.european_aqi !== undefined) {
    const aqi = data.current.european_aqi;
    let aqiLevel = '';
    if (aqi <= 20) aqiLevel = '优';
    else if (aqi <= 40) aqiLevel = '良';
    else if (aqi <= 60) aqiLevel = '中等';
    else if (aqi <= 80) aqiLevel = '一般';
    else if (aqi <= 100) aqiLevel = '差';
    else aqiLevel = '严重';
    airQuality = `${aqiLevel} (${aqi})`;
  }
  let weatherCondition = '未知';
  let weatherIcon = weatherIcons['未知'];
  if (weatherCode !== undefined) {
    if (weatherCode === 0) {
      weatherCondition = '晴';
      weatherIcon = weatherIcons['晴'];
    } else if (weatherCode === 1) {
      weatherCondition = '大部晴朗';
      weatherIcon = weatherIcons['晴'];
    } else if (weatherCode === 2) {
      weatherCondition = '局部多云';
      weatherIcon = weatherIcons['多云'];
    } else if (weatherCode === 3) {
      weatherCondition = '多云';
      weatherIcon = weatherIcons['多云'];
    } else if ([45, 48].includes(weatherCode)) {
      weatherCondition = '雾';
      weatherIcon = weatherIcons['雾'];
    } else if ([51, 53, 55, 56, 57].includes(weatherCode)) {
      weatherCondition = '小雨';
      weatherIcon = weatherIcons['小雨'];
    } else if ([61, 63, 66, 80, 81].includes(weatherCode)) {
      weatherCondition = '中雨';
      weatherIcon = weatherIcons['中雨'];
    } else if ([65, 67, 82].includes(weatherCode)) {
      weatherCondition = '大雨';
      weatherIcon = weatherIcons['大雨'];
    } else if ([95, 96, 99].includes(weatherCode)) {
      weatherCondition = '雷雨';
      weatherIcon = weatherIcons['雷'];
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
      weatherCondition = '雪';
      weatherIcon = weatherIcons['雪'];
    } else {
      weatherCondition = '阴';
      weatherIcon = weatherIcons['阴'];
    }
  }
  return {
    location: userLocation || '未知位置',
    condition: weatherCondition,
    temperature: temperature,
    tempRange: tempRange,
    airQuality: airQuality,
    humidity: humidity,
    time: timeString,
    fullDateTime: fullDateTime,
    icon: weatherIcon
  };
}
export default function WeatherIsland() {
  const [weatherData, setWeatherData] = useState({
    location: '',
    condition: '',
    temperature: '',
    tempRange: '',
    airQuality: '',
    time: '',
    fullDateTime: '',
    icon: '🌤️'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState('');
  const weatherCacheRef = useRef({
    data: null,
    lastUpdated: 0,
    location: '',
    coordinates: null
  });
  /**
   * 获取用户位置信息和经纬度坐标
   * 使用 api.myip.la/cn?json 获取位置和坐标（JSON格式）
   * 如果失败，回退到 myip.ipip.net（纯文本格式）
   * @returns {Promise<{location: string, coordinates: {latitude: number, longitude: number} | null}>}
   */
  const fetchUserLocation = async () => {
    try {
      if (weatherCacheRef.current.location && weatherCacheRef.current.coordinates) {
        console.log('使用缓存的位置信息和坐标');
        return {
          location: weatherCacheRef.current.location,
          coordinates: weatherCacheRef.current.coordinates
        };
      }
      console.log('正在使用 api.myip.la 获取地区信息和坐标...');
      let location = '';
      let coordinates = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); 
        const myipLaResponse = await fetch('https://api.myip.la/cn?json', {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          }
        });
        clearTimeout(timeoutId);
        if (myipLaResponse.ok) {
          const data = await myipLaResponse.json();
          console.log('api.myip.la 返回数据:', data);
          if (data && data.location) {
            if (data.location.latitude && data.location.longitude) {
              coordinates = {
                latitude: parseFloat(data.location.latitude),
                longitude: parseFloat(data.location.longitude)
              };
              console.log(`从 api.myip.la 获取到坐标: ${coordinates.latitude}, ${coordinates.longitude}`);
            }
            const province = data.location.province || '';
            const city = data.location.city || '';
            if (province && city) {
              if (city.includes(province.replace('省', '').replace('市', '').replace('都', ''))) {
                location = city;
              } else {
                location = province + city;
              }
              console.log(`从 api.myip.la 获取到位置: ${location}`);
            } else if (province) {
              location = province;
            } else if (city) {
              location = city;
            } else if (data.location.country_name) {
              location = data.location.country_name;
            }
          }
        }
      } catch (error) {
        console.warn('api.myip.la 获取失败，将回退到备用方案:', error.message);
      }
      if (!location) {
        console.log('正在使用备用 API myip.ipip.net 获取地区信息...');
        try {
          const ipipResponse = await fetch('https://myip.ipip.net', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
              'Referer': 'https://www.baidu.com/',
              'Accept-Language': 'zh-CN,zh;q=0.9',
              'Keep-Alive': 'yes',
              'Cache-Control': 'no-cache'
            }
          });
          if (ipipResponse.ok) {
            const text = await ipipResponse.text();
            console.log('myip.ipip.net 返回数据:', text);
            if (text && text.includes('来自于：')) {
              const locationPart = text.split('来自于：')[1];
              if (locationPart) {
                const locationInfo = locationPart.split('  ')[0];
                if (locationInfo) {
                  const parts = locationInfo.trim().split(' ');
                  if (parts.length >= 3) {
                    location = parts[1] + parts[2];
                  } else if (parts.length === 2) {
                    location = parts[1];
                  } else {
                    location = parts[0];
                  }
                  console.log(`从 myip.ipip.net 获取到位置: ${location}`);
                  try {
                    console.log(`正在使用 OpenStreetMap 获取 ${location} 的坐标...`);
                    coordinates = await getCoordinates(location);
                    if (coordinates) {
                      console.log(`成功获取 ${location} 的坐标: ${coordinates.latitude}, ${coordinates.longitude}`);
                    }
                  } catch (geoError) {
                    console.error(`获取 ${location} 坐标失败:`, geoError);
                  }
                }
              }
            }
          }
        } catch (fallbackError) {
          console.error('备用 API 也失败了:', fallbackError.message);
        }
      }
      if (!location) {
        console.warn('无法获取位置信息');
        return { location: '', coordinates: null };
      }
      console.log(`最终使用的位置: ${location}`);
      weatherCacheRef.current.location = location;
      weatherCacheRef.current.coordinates = coordinates;
      setUserLocation(location);
      return { location, coordinates };
    } catch (error) {
      console.error('获取位置信息过程中发生错误:', error);
      return { location: '', coordinates: null };
    }
  };
  /**
   * 将城市名称转换为经纬度坐标
   * 主要用于 myip.ipip.net 返回的中文城市名称
   * @param {string} cityName - 城市名称
   * @returns {Promise<{latitude: number, longitude: number} | null>} - 经纬度坐标或null
   */
  const getCoordinates = async (cityName) => {
    if (!cityName) return null;
    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1&accept-language=zh-Hans&countrycodes=CN`;
      console.log(`正在获取 ${cityName} 的坐标...`);
      const response = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      if (!response.ok) {
        throw new Error('地理编码请求失败');
      }
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        console.log(`获取到 ${cityName} 的坐标: ${lat}, ${lon}`);
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      }
      if (cityName.length > 2) {
        const province = cityName.substring(0, 2); 
        console.log(`尝试使用省份名称获取坐标: ${province}`);
        const provinceUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(province)}&format=json&limit=1&accept-language=zh-Hans&countrycodes=CN`;
        const provinceResponse = await fetch(provinceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          }
        });
        if (provinceResponse.ok) {
          const provinceData = await provinceResponse.json();
          if (provinceData && provinceData.length > 0) {
            const { lat, lon } = provinceData[0];
            console.log(`使用省份 ${province} 的坐标: ${lat}, ${lon}`);
            return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
          }
        }
      }
      console.warn(`无法获取 ${cityName} 的坐标，天气服务暂不支持该地区`);
      return null;
    } catch (error) {
      console.error('获取坐标失败:', error);
      return null;
    }
  };
  const isApiCallInProgress = useRef(false);
  const lastApiCallTime = useRef(0);
  const MIN_API_INTERVAL = 5000; 
  /**
   * 获取当地天气信息
   * 使用 Open Meteo API - 添加防护机制防止无限调用
   */
  const fetchWeather = async () => {
    if (isApiCallInProgress.current) {
      console.log('天气API调用正在进行中，跳过重复请求');
      return;
    }
    const now = Date.now();
    if (now - lastApiCallTime.current < MIN_API_INTERVAL) {
      console.log('天气API调用过于频繁，跳过请求');
      return;
    }
    isApiCallInProgress.current = true;
    lastApiCallTime.current = now;
    setIsLoading(true);
    try {
      if (weatherCacheRef.current.data &&
          (now - weatherCacheRef.current.lastUpdated < CACHE_DURATION)) {
        console.log('使用缓存的天气信息');
        setWeatherData(weatherCacheRef.current.data);
        setIsLoading(false);
        isApiCallInProgress.current = false;
        return;
      }
      const { location, coordinates } = await fetchUserLocation();
      console.log(`获取到位置: ${location}`);
      if (!location) {
        const errorData = processWeatherData(
          { error: true, reason: '该位置暂不支持' },
          now,
          '未知位置'
        );
        setWeatherData(errorData);
        setIsLoading(false);
        return;
      }
      if (!coordinates) {
        const errorData = processWeatherData(
          { error: true, reason: '无法获取该位置的坐标' },
          now,
          location
        );
        setWeatherData(errorData);
        setIsLoading(false);
        return;
      }
      const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
      const airQualityApiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&current=european_aqi&timezone=auto`;
      console.log('正在获取天气信息...');
      console.log('天气 API URL:', weatherApiUrl);
      console.log('空气质量 API URL:', airQualityApiUrl);
      const weatherController = new AbortController();
      const weatherTimeoutId = setTimeout(() => weatherController.abort(), 4000); 
      const weatherResponse = await fetch(weatherApiUrl, {
        signal: weatherController.signal,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });
      clearTimeout(weatherTimeoutId);
      if (!weatherResponse.ok) {
        throw new Error(`获取天气信息失败: ${weatherResponse.status} ${weatherResponse.statusText}`);
      }
      const weatherData = await weatherResponse.json();
      console.log('天气数据获取成功:', weatherData);
      let airQualityData = { current: { european_aqi: null } };
      try {
        const airQualityController = new AbortController();
        const airQualityTimeoutId = setTimeout(() => airQualityController.abort(), 5000);
        const airQualityResponse = await fetch(airQualityApiUrl, {
          signal: airQualityController.signal,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          }
        });
        clearTimeout(airQualityTimeoutId);
        if (airQualityResponse.ok) {
          airQualityData = await airQualityResponse.json();
          console.log('空气质量数据获取成功:', airQualityData);
        } else {
          console.warn(`获取空气质量信息失败: ${airQualityResponse.status} ${airQualityResponse.statusText}`);
        }
      } catch (airQualityError) {
        console.warn('获取空气质量数据时出错:', airQualityError);
      }
      const combinedData = {
        ...weatherData,
        current: {
          ...weatherData.current,
          european_aqi: airQualityData.current?.european_aqi
        }
      };
      const parsedWeatherData = processWeatherData(combinedData, now, location, coordinates);
      weatherCacheRef.current.data = parsedWeatherData;
      weatherCacheRef.current.lastUpdated = now;
      setWeatherData(parsedWeatherData);
      setIsLoading(false);
    } catch (error) {
      console.error('获取天气信息失败:', error);
      const errorData = processWeatherData(
        { error: true, reason: error.message },
        Date.now(),
        weatherCacheRef.current.location || '未知位置'
      );
      setWeatherData(errorData);
      setIsLoading(false);
    } finally {
      isApiCallInProgress.current = false;
    }
  };
  useEffect(() => {
    let isComponentMounted = true; 
    let visibilityChangeHandler = null;
    const initWeather = () => {
      if (!isComponentMounted) return;
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          if (isComponentMounted) {
            fetchWeather();
          }
        });
      } else {
        setTimeout(() => {
          if (isComponentMounted) {
            fetchWeather();
          }
        }, 1000);
      }
    };
    visibilityChangeHandler = () => {
      if (!isComponentMounted || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!weatherCacheRef.current.data ||
          (now - weatherCacheRef.current.lastUpdated > CACHE_DURATION)) {
        console.log('页面可见，检查是否需要更新天气信息');
        fetchWeather();
      }
    };
    initWeather();
    document.addEventListener('visibilitychange', visibilityChangeHandler, { passive: true });
    return () => {
      isComponentMounted = false;
      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler);
      }
    };
  }, []); 
  return (
    <div className="mb-6 p-4 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-center">
        <span className="text-2xl mr-3">{weatherData.icon}</span>
        <div className="text-sm">
          <div className="font-medium">当地天气</div>
          {isLoading ? (
            <div className="text-gray-600 dark:text-gray-300 flex items-end">
              加载中
              <span className="inline-block ml-px font-bold animate-wave">.</span>
              <span className="inline-block ml-px font-bold animate-wave [animation-delay:0.1s]">.</span>
              <span className="inline-block ml-px font-bold animate-wave [animation-delay:0.2s]">.</span>
            </div>
          ) : (
            <>
              <div className="text-gray-600 dark:text-gray-300">
                {`${weatherData.location}: ${weatherData.condition} ${weatherData.temperature}`}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {`${weatherData.tempRange} | 空气质量: ${weatherData.airQuality} | 湿度: ${weatherData.humidity}`}
              </div>
              {weatherData.fullDateTime && (
                <div className="text-xs text-gray-500 dark:text-gray-400" data-component-name="WeatherIsland">
                  {`${weatherData.fullDateTime}`}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
