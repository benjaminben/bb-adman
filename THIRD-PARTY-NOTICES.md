# Third-party notices

This file lists software that ships inside Adman under its own licence. The notice for
Adman itself is not written yet.

## FFmpeg

Adman ships one FFmpeg program, `ffmpeg` (`ffmpeg.exe` on Windows). In the installed app it is
at `ffmpeg/{platform}-{arch}/` inside the app's resources folder (on macOS,
`Adman.app/Contents/Resources/ffmpeg/darwin-arm64/ffmpeg` or `.../darwin-x64/ffmpeg`). Adman
runs it as a separate program; it is not linked into Adman.

### Licence

FFmpeg is licensed under the GNU Lesser General Public License (LGPL), version 2.1 or later.
This build is LGPL only: it was configured with `--disable-gpl` and `--disable-nonfree`, and
the build checks that `ffmpeg -L` names the LGPL before the program is accepted. The notice
the program prints (`ffmpeg -hide_banner -L`) reads:

> ffmpeg is free software; you can redistribute it and/or
> modify it under the terms of the GNU Lesser General Public
> License as published by the Free Software Foundation; either
> version 2.1 of the License, or (at your option) any later version.
>
> ffmpeg is distributed in the hope that it will be useful,
> but WITHOUT ANY WARRANTY; without even the implied warranty of
> MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
> Lesser General Public License for more details.
>
> You should have received a copy of the GNU Lesser General Public
> License along with ffmpeg; if not, write to the Free Software
> Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA

The full licence text is the file `COPYING.LGPLv2.1` at the top of the FFmpeg source archive
below, and is published at https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html.

### Source

The macOS program is built from the unchanged FFmpeg 9.0.2 source release:

- Source: https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
- SHA-256 of that archive: `8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e`

You may get this source, change it and rebuild the program with the flags below. Replacing
the `ffmpeg` file in the app's resources folder with your own build is enough for Adman to
use it.

### Build flags

The macOS build runs FFmpeg's `./configure` with exactly these flags, in this order (they are
kept in `scripts/ffmpeg-sources.json`):

```
--disable-everything
--disable-gpl
--disable-nonfree
--disable-network
--disable-autodetect
--disable-doc
--disable-ffplay
--disable-ffprobe
--disable-x86asm
--enable-pthreads
--enable-zlib
--enable-videotoolbox
--enable-audiotoolbox
--enable-decoder=h264,hevc,vp8,vp9,prores,png,mjpeg,webp,rawvideo,wrapped_avframe,aac,mp3float,mp3,alac,opus,vorbis,pcm_u8,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le
--enable-demuxer=mov,matroska,image2,image2pipe,ffmetadata,mp3,wav,aac
--enable-muxer=mp4,mov,image2pipe
--enable-parser=h264,hevc,vp8,vp9,png,mjpeg,webp,aac,mpegaudio,opus,vorbis
--enable-bsf=aac_adtstoasc
--enable-protocol=file,pipe
--enable-filter=color,trim,scale,crop,overlay,format,setpts,fps,loop,anullsrc,aresample,atrim,asetpts,adelay,apad,amix,concat
--enable-encoder=h264_videotoolbox,aac_at,aac,png
--enable-indev=lavfi
```

### Windows

The Windows x64 program is a prebuilt LGPL release, pinned by address and SHA-256 in
`scripts/ffmpeg-sources.json`:

- Program archive: https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-21-12-37/ffmpeg-n9.0.2-61-gd59078794d-win64-lgpl-9.0.zip
- SHA-256 of that archive: `3508eac94b9cfd5ffe34e88cef4fd5ba15b4ccdd6b4083488e070c702342a26a`

Its build flags and matching source are published with that release.
