declare module 'epub-gen' {
  interface EPubOptions {
    title: string
    author: string
    publisher?: string
    cover?: string
    css?: string
    fonts?: string[]
    lang?: string
    appendChapterTitles?: boolean
    customOpfTemplatePath?: string
    customNcxTocTemplatePath?: string
    customHtmlTocTemplatePath?: string
    content?: Array<{
      title?: string
      author?: string
      data: string
    }>
  }

  class EPub {
    constructor(options: EPubOptions, output?: string)
    render(): Promise<void>
    generate(): Promise<Buffer>
  }

  export default EPub
}
