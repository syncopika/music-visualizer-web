// add this so vite/client understands how to deal with gltf files
declare module "*.gltf" {
  const content: string;
  export default content;
}