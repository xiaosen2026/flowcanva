declare module 'pannellum' {
  const pannellum: {
    viewer: (element: HTMLElement | string, config: Record<string, any>) => any
  }
  export default pannellum
}

declare module 'pannellum/build/pannellum.css'
