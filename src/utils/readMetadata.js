import jsmediatags from "jsmediatags"
   
   export function readMetadata(file) {
     return new Promise((resolve) => {
       jsmediatags.read(file, {
         onSuccess: ({ tags }) => {
           const { title, artist, album, picture } = tags
           let coverUrl = null
   
           if (picture) {
             const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format })
             coverUrl = URL.createObjectURL(blob)
           }
   
           resolve({ title, artist, album, coverUrl })
         },
         onError: () => {
           resolve({ title: null, artist: null, album: null, coverUrl: null })
         },
       })
     })
   }