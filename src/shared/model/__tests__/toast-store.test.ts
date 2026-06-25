import { ToastVariantEnum, useToastStore } from '../toast-store';

// Сброс очереди между тестами: стор — модульный синглтон.
const resetStore = () => useToastStore.setState({ toasts: [] });

describe('toast-store', () => {
  beforeEach(resetStore);

  it('showToast добавляет тост в очередь', () => {
    useToastStore.getState().showToast(ToastVariantEnum.Error, 'Ошибка');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ message: 'Ошибка', variant: ToastVariantEnum.Error });
    expect(typeof toasts[0].id).toBe('number');
  });

  it('dismissToast убирает тост по id', () => {
    const { showToast } = useToastStore.getState();
    showToast(ToastVariantEnum.Info, 'Первый');
    showToast(ToastVariantEnum.Success, 'Второй');

    const [first] = useToastStore.getState().toasts;
    useToastStore.getState().dismissToast(first.id);

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Второй');
  });

  it('dismissToast с несуществующим id ничего не меняет', () => {
    useToastStore.getState().showToast(ToastVariantEnum.Error, 'Один');
    useToastStore.getState().dismissToast(-999);

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('держит не больше 3 тостов, вытесняя самые старые (FIFO)', () => {
    const { showToast } = useToastStore.getState();
    showToast(ToastVariantEnum.Info, 'A');
    showToast(ToastVariantEnum.Info, 'B');
    showToast(ToastVariantEnum.Info, 'C');
    showToast(ToastVariantEnum.Info, 'D');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(3);
    expect(toasts.map((toast) => toast.message)).toEqual(['B', 'C', 'D']);
  });
});
