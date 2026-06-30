// Публичный API слайса photo-capture. photoPermissionService наружу не выносится — деталь
// реализации, потребитель только UI самого слайса. photoService отдаём — `pages/photo` использует
// `deletePhoto` для orphan-cleanup при отмене/пересъёмке (снимок копируется в постоянное хранилище
// до подтверждения пользователем).
export { PhotoCaptureView, type IPhotoCaptureViewProps } from './ui/photo-capture-view';
export { PhotoPreview, type IPhotoPreviewProps } from './ui/photo-preview';
export { photoService } from './lib/photoService';
