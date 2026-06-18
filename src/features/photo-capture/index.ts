// Публичный API слайса photo-capture. Сервисы (photoService, photoPermissionService) наружу
// не выносятся — это детали реализации, потребитель которых только UI самого слайса.
export { PhotoCaptureView, type IPhotoCaptureViewProps } from './ui/photo-capture-view';
export { PhotoPreview, type IPhotoPreviewProps } from './ui/photo-preview';
