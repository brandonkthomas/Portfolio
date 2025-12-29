using System.Buffers.Binary;
using System.Text;

namespace RealityCheck.Web.Services;

// ============================================================================================
/// <summary>
/// A class to read the dimensions of an image file.
/// </summary>
internal static class ImageDimensionReader
{
    private static readonly byte[] PngSignature = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 };
    private static readonly byte[] IhdrChunkType = Encoding.ASCII.GetBytes("IHDR");
    private static readonly byte[] Gif87a = Encoding.ASCII.GetBytes("GIF87a");
    private static readonly byte[] Gif89a = Encoding.ASCII.GetBytes("GIF89a");
    private static readonly byte[] RiffHeader = Encoding.ASCII.GetBytes("RIFF");
    private static readonly byte[] WebpHeader = Encoding.ASCII.GetBytes("WEBP");
    private static readonly byte[] Vp8xChunk = Encoding.ASCII.GetBytes("VP8X");
    private static readonly byte[] Vp8Chunk = Encoding.ASCII.GetBytes("VP8 ");
    private static readonly byte[] Vp8LChunk = Encoding.ASCII.GetBytes("VP8L");

    //==============================================================================================
    /// <summary>
    /// Try to get the dimensions of an image file
    /// </summary>
    public static bool TryGetDimensions(string filePath, out int width, out int height)
    {
        width = 0;
        height = 0;

        try
        {
            var extension = Path.GetExtension(filePath)?.ToLowerInvariant();
            using var stream = File.OpenRead(filePath);
            return extension switch
            {
                ".png" => TryReadPng(stream, out width, out height),
                ".gif" => TryReadGif(stream, out width, out height),
                ".webp" => TryReadWebp(stream, out width, out height),
                ".jpg" or ".jpeg" => TryReadJpeg(stream, out width, out height),
                _ => false
            };
        }
        catch
        {
            width = 0;
            height = 0;
            return false;
        }
    }

    // ============================================================================================
    /// <summary>
    /// Try to read the dimensions of a PNG image
    /// </summary>
    /// <param name="stream">The stream to read the image from</param>
    /// <param name="width">The width of the image</param>
    /// <param name="height">The height of the image</param>
    /// <returns>True if the dimensions were successfully read, false otherwise</returns>
    private static bool TryReadPng(Stream stream, out int width, out int height)
    {
        width = 0;
        height = 0;

        Span<byte> signature = stackalloc byte[8];
        if (!TryFill(stream, signature) || !signature.SequenceEqual(PngSignature))
        {
            return false;
        }

        Span<byte> chunkHeader = stackalloc byte[8];
        if (!TryFill(stream, chunkHeader))
        {
            return false;
        }

        if (!chunkHeader[4..8].SequenceEqual(IhdrChunkType))
        {
            return false;
        }

        int chunkLength = BinaryPrimitives.ReadInt32BigEndian(chunkHeader[..4]);
        if (chunkLength < 8)
        {
            return false;
        }

        Span<byte> dimensions = stackalloc byte[8];
        if (!TryFill(stream, dimensions))
        {
            return false;
        }

        width = BinaryPrimitives.ReadInt32BigEndian(dimensions[..4]);
        height = BinaryPrimitives.ReadInt32BigEndian(dimensions[4..]);
        return width > 0 && height > 0;
    }

    // ============================================================================================
    /// <summary>
    /// Try to read the dimensions of a GIF image
    /// </summary>
    /// <param name="stream">The stream to read the image from</param>
    /// <param name="width">The width of the image</param>
    /// <param name="height">The height of the image</param>
    /// <returns>True if the dimensions were successfully read, false otherwise</returns>
    private static bool TryReadGif(Stream stream, out int width, out int height)
    {
        width = 0;
        height = 0;

        Span<byte> header = stackalloc byte[6];
        if (!TryFill(stream, header))
        {
            return false;
        }

        if (!header.SequenceEqual(Gif87a) && !header.SequenceEqual(Gif89a))
        {
            return false;
        }

        Span<byte> dimensions = stackalloc byte[4];
        if (!TryFill(stream, dimensions))
        {
            return false;
        }

        width = BinaryPrimitives.ReadUInt16LittleEndian(dimensions[..2]);
        height = BinaryPrimitives.ReadUInt16LittleEndian(dimensions[2..]);
        return width > 0 && height > 0;
    }

    // ============================================================================================
    /// <summary>
    /// Try to read the dimensions of a JPEG image
    /// </summary>
    /// <param name="stream">The stream to read the image from</param>
    /// <param name="width">The width of the image</param>
    /// <param name="height">The height of the image</param>
    /// <returns>True if the dimensions were successfully read, false otherwise</returns>
    private static bool TryReadJpeg(Stream stream, out int width, out int height)
    {
        width = 0;
        height = 0;

        if (stream.ReadByte() != 0xFF || stream.ReadByte() != 0xD8)
        {
            return false;
        }

        while (true)
        {
            int markerPrefix = stream.ReadByte();
            if (markerPrefix == -1)
            {
                return false;
            }

            if (markerPrefix != 0xFF)
            {
                continue;
            }

            int marker = stream.ReadByte();
            if (marker == -1)
            {
                return false;
            }

            while (marker == 0xFF)
            {
                marker = stream.ReadByte();
                if (marker == -1)
                {
                    return false;
                }
            }

            if (marker == 0xD9 || marker == 0xDA)
            {
                break;
            }

            if (!TryReadUInt16BigEndian(stream, out var segmentLength) || segmentLength < 2)
            {
                return false;
            }

            var payloadLength = segmentLength - 2;

            if (IsStartOfFrame(marker))
            {
                if (!SkipBytes(stream, 1))
                {
                    return false;
                }

                if (!TryReadUInt16BigEndian(stream, out height) || !TryReadUInt16BigEndian(stream, out width))
                {
                    return false;
                }

                return width > 0 && height > 0;
            }

            if (!SkipBytes(stream, payloadLength))
            {
                return false;
            }
        }

        return false;
    }

    // ============================================================================================
    /// <summary>
    /// Try to read the dimensions of a WebP image
    /// </summary>
    /// <param name="stream">The stream to read the image from</param>
    /// <param name="width">The width of the image</param>
    /// <param name="height">The height of the image</param>
    /// <returns>True if the dimensions were successfully read, false otherwise</returns>
    private static bool TryReadWebp(Stream stream, out int width, out int height)
    {
        width = 0;
        height = 0;

        Span<byte> riffHeader = stackalloc byte[12];
        if (!TryFill(stream, riffHeader))
        {
            return false;
        }

        if (!riffHeader[..4].SequenceEqual(RiffHeader) || !riffHeader[8..12].SequenceEqual(WebpHeader))
        {
            return false;
        }

        Span<byte> chunkHeader = stackalloc byte[8];
        Span<byte> vp8Buffer = stackalloc byte[10];
        Span<byte> vp8lBuffer = stackalloc byte[5];

        while (stream.Position + 8 <= stream.Length)
        {
            if (!TryFill(stream, chunkHeader))
            {
                return false;
            }

            var chunkSize = BinaryPrimitives.ReadInt32LittleEndian(chunkHeader[4..8]);
            if (chunkSize < 0)
            {
                return false;
            }

            var chunkType = chunkHeader[..4];
            var dataStart = stream.Position;

            if (chunkType.SequenceEqual(Vp8xChunk))
            {
                if (chunkSize < 10)
                {
                    return false;
                }

                if (!TryFill(stream, vp8Buffer))
                {
                    return false;
                }

                width = ((vp8Buffer[4] | (vp8Buffer[5] << 8) | (vp8Buffer[6] << 16))) + 1;
                height = ((vp8Buffer[7] | (vp8Buffer[8] << 8) | (vp8Buffer[9] << 16))) + 1;
                return width > 0 && height > 0;
            }
            else if (chunkType.SequenceEqual(Vp8Chunk))
            {
                if (chunkSize < 10)
                {
                    return false;
                }

                if (!TryFill(stream, vp8Buffer))
                {
                    return false;
                }

                if (vp8Buffer[3] == 0x9d && vp8Buffer[4] == 0x01 && vp8Buffer[5] == 0x2a)
                {
                    width = BinaryPrimitives.ReadUInt16LittleEndian(vp8Buffer.Slice(6, 2));
                    height = BinaryPrimitives.ReadUInt16LittleEndian(vp8Buffer.Slice(8, 2));
                    if (width > 0 && height > 0)
                    {
                        return true;
                    }
                }
            }
            else if (chunkType.SequenceEqual(Vp8LChunk))
            {
                if (chunkSize < 5)
                {
                    return false;
                }

                if (!TryFill(stream, vp8lBuffer))
                {
                    return false;
                }

                if (vp8lBuffer[0] == 0x2f)
                {
                    uint packed = BinaryPrimitives.ReadUInt32LittleEndian(vp8lBuffer.Slice(1, 4));
                    width = (int)((packed & 0x3FFF) + 1);
                    height = (int)(((packed >> 14) & 0x3FFF) + 1);
                    if (width > 0 && height > 0)
                    {
                        return true;
                    }
                }
            }

            var consumed = stream.Position - dataStart;
            var remaining = chunkSize - consumed;
            if (remaining > 0 && !SkipBytes(stream, (int)remaining))
            {
                return false;
            }

            if ((chunkSize & 1) == 1 && !SkipBytes(stream, 1))
            {
                return false;
            }
        }

        return false;
    }

    // ============================================================================================
    /// <summary>
    /// Try to read a 16-bit unsigned integer from a stream in big-endian order
    /// </summary>
    /// <param name="stream">The stream to read the integer from</param>
    /// <param name="value">The value read from the stream</param>
    /// <returns>True if the integer was successfully read, false otherwise</returns>
    private static bool TryReadUInt16BigEndian(Stream stream, out int value)
    {
        Span<byte> buffer = stackalloc byte[2];
        if (!TryFill(stream, buffer))
        {
            value = 0;
            return false;
        }

        value = BinaryPrimitives.ReadUInt16BigEndian(buffer);
        return true;
    }

    // ============================================================================================
    /// <summary>
    /// Try to fill a buffer with data from a stream
    /// </summary>
    /// <param name="stream">The stream to read the data from</param>
    /// <param name="buffer">The buffer to fill</param>
    /// <returns>True if the buffer was successfully filled, false otherwise</returns>
    private static bool TryFill(Stream stream, Span<byte> buffer)
    {
        var totalRead = 0;
        while (totalRead < buffer.Length)
        {
            var read = stream.Read(buffer[totalRead..]);
            if (read == 0)
            {
                return false;
            }
            totalRead += read;
        }
        return true;
    }

    // ============================================================================================
    /// <summary>
    /// Try to skip a number of bytes in a stream
    /// </summary>
    /// <param name="stream">The stream to skip the bytes in</param>
    /// <param name="count">The number of bytes to skip</param>
    /// <returns>True if the bytes were successfully skipped, false otherwise</returns>
    private static bool SkipBytes(Stream stream, int count)
    {
        if (count <= 0)
        {
            return true;
        }

        if (stream.CanSeek)
        {
            stream.Seek(count, SeekOrigin.Current);
            return true;
        }

        Span<byte> buffer = stackalloc byte[Math.Min(count, 4096)];
        var remaining = count;
        while (remaining > 0)
        {
            var read = stream.Read(buffer[..Math.Min(buffer.Length, remaining)]);
            if (read == 0)
            {
                return false;
            }
            remaining -= read;
        }
        return true;
    }

    // ============================================================================================
    /// <summary>
    /// Check if a marker is the start of a frame
    /// </summary>
    /// <param name="marker">The marker to check</param>
    /// <returns>True if the marker is the start of a frame, false otherwise</returns>
    private static bool IsStartOfFrame(int marker)
    {
        return marker is >= 0xC0 and <= 0xC3
            or >= 0xC5 and <= 0xC7
            or >= 0xC9 and <= 0xCB
            or >= 0xCD and <= 0xCF;
    }
}
