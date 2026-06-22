import { OrderStatusLabel, ServiceOrderStatusEnum } from '../order-status';

describe('OrderStatusLabel', () => {
  it.each([
    [ServiceOrderStatusEnum.New, 'Новая'],
    [ServiceOrderStatusEnum.InProgress, 'В работе'],
    [ServiceOrderStatusEnum.Done, 'Готово'],
    [ServiceOrderStatusEnum.Cancelled, 'Отменено'],
  ])('подписывает статус %s как "%s"', (status, label) => {
    expect(OrderStatusLabel[status]).toBe(label);
  });

  it('покрывает все значения ServiceOrderStatusEnum без лишних ключей', () => {
    const statusValues = Object.values(ServiceOrderStatusEnum).sort();
    const labelKeys = Object.keys(OrderStatusLabel).sort();
    expect(labelKeys).toEqual(statusValues);
  });

  it('не содержит пустых подписей', () => {
    for (const label of Object.values(OrderStatusLabel)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
