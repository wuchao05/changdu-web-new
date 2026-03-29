declare module 'crypto-js/md5' {
  import { WordArray } from 'crypto-js'

  function md5(message: string | WordArray): WordArray
  export = md5
}
