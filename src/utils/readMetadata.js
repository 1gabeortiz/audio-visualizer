import jsmediatags from "jsmediatags/dist/jsmediatags.min.js"

export function readMetadata(file) {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: ({ tags }) => {
        const { title, artist, album, picture } = tags
        let coverUrl = null

        // Convert embedded cover art bytes into a blob URL for <img src>.
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