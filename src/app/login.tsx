import type { FC } from 'react';

import { LoginPage } from '@/pages/login';

// Тонкий route: рендерит страницу входа из pages/login. Доступность экрана — через
// Stack.Protected guard в src/app/_layout.tsx (по статусу сессии), не здесь.
const LoginRoute: FC = () => <LoginPage />;

export default LoginRoute;
