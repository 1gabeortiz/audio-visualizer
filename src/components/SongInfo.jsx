function SongInfo({ fileName, metadata }) {
    if (!fileName) return null
   
    const title = metadata?.title?.trim() || fileName
    const artist = metadata?.artist?.trim()
    const album = metadata?.album?.trim()
    const coverUrl = metadata?.coverUrl
   
    return (
        <section className="song-info">
        {coverUrl ? (
        <img className="cover-art" src={coverUrl} alt="Album cover" />
        ) : (
           <div className="cover-art">No Cover</div>
        )}
   
        <div className="song-details">
        <p className="song-title">{title}</p>
        {artist && <p className="song-meta">{artist}</p>}
        {album && <p className="song-meta">{album}</p>}
        </div>

        </section>
     )
   }
   
   export default SongInfo