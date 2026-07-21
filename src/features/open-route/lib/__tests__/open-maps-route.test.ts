import { buildRtext } from '../open-maps-route';

describe('buildRtext', () => {
  it('с origin: "lat,lon~lat,lon" (порядок широта, долгота, без URL-кодирования)', () => {
    const origin = { latitude: 55.75, longitude: 37.61 };
    const destination = { latitude: 55.8, longitude: 37.5 };

    expect(buildRtext(destination, origin)).toBe('55.75,37.61~55.8,37.5');
  });

  it('без origin (null): "~lat,lon" — Яндекс строит маршрут от текущего положения сам', () => {
    const destination = { latitude: 55.8, longitude: 37.5 };

    expect(buildRtext(destination, null)).toBe('~55.8,37.5');
  });

  it('отрицательные координаты сохраняют знак минуса', () => {
    const origin = { latitude: -33.87, longitude: -70.65 };
    const destination = { latitude: -34.6, longitude: -58.38 };

    expect(buildRtext(destination, origin)).toBe('-33.87,-70.65~-34.6,-58.38');
  });
});
