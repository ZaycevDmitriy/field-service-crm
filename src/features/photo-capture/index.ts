// Публичный API слайса photo-capture. photoService/photoPermissionService наружу не выносятся —
// детали реализации, потребитель только UI самого слайса. Наружу отдаём узкую операцию `deletePhoto`:
// `pages/photo` зовёт её для orphan-cleanup при отмене/пересъёмке (снимок копируется в постоянное
// хранилище до подтверждения пользователем).
export { PhotoCaptureView, type IPhotoCaptureViewProps } from './ui/photo-capture-view';
export { PhotoPreview, type IPhotoPreviewProps } from './ui/photo-preview';
export { deletePhoto } from './lib/photoService';
