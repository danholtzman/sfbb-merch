// A back design alone does not make a back shirt view available.
export function backPhotoColorIds(colors: Array<{id:string}>, photos: Array<{side:string;colorId:string|null}>): string[] {
 const backs=photos.filter(photo=>photo.side === "back");
 return colors.filter(color=>backs.some(photo=>photo.colorId === null || photo.colorId === color.id)).map(color=>color.id);
}
