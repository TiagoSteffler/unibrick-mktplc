const FHD_PIXELS = 1920 * 1080
const TARGET_BYTES = 500 * 1024
const JPEG_TYPE = 'image/jpeg'

function readImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Falha ao ler imagem para processamento.'))
    }

    image.src = objectUrl
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao preparar visualizacao da imagem.'))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao gerar imagem processada.'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })
}

function isFhdOrLarger(width, height) {
  return width * height >= FHD_PIXELS
}

function pickTargetSize(width, height) {
  if (!isFhdOrLarger(width, height)) {
    return { width, height }
  }

  const isPortrait = height > width
  const longSide = Math.max(width, height)
  const shortSide = Math.min(width, height)
  const ratio = longSide / shortSide

  const ratio16x9 = 16 / 9
  const ratio4x3 = 4 / 3
  const ratioTolerance = 0.08

  let targetLong = 1600
  let targetShort

  if (Math.abs(ratio - ratio16x9) <= ratioTolerance) {
    targetShort = 900
  } else if (Math.abs(ratio - ratio4x3) <= ratioTolerance) {
    targetShort = 1200
  } else {
    targetShort = Math.round(targetLong / ratio)
  }

  if (longSide <= targetLong) {
    return { width, height }
  }

  if (isPortrait) {
    return { width: targetShort, height: targetLong }
  }

  return { width: targetLong, height: targetShort }
}

function drawToCanvas(image, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Falha ao preparar compressao da imagem.')
  }

  // Fundo branco evita transparencia escura quando convertido para JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas
}

async function compressCanvas(canvas) {
  const qualitySteps = [0.82, 0.75, 0.68, 0.6, 0.52, 0.45]

  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, JPEG_TYPE, quality)

    if (blob.size <= TARGET_BYTES) {
      return blob
    }
  }

  let resizedCanvas = canvas

  for (let index = 0; index < 3; index += 1) {
    const nextWidth = Math.max(640, Math.round(resizedCanvas.width * 0.9))
    const nextHeight = Math.max(480, Math.round(resizedCanvas.height * 0.9))

    if (nextWidth === resizedCanvas.width && nextHeight === resizedCanvas.height) {
      break
    }

    const tmp = document.createElement('canvas')
    tmp.width = nextWidth
    tmp.height = nextHeight

    const ctx = tmp.getContext('2d')

    if (!ctx) {
      break
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, nextWidth, nextHeight)
    ctx.drawImage(resizedCanvas, 0, 0, nextWidth, nextHeight)
    resizedCanvas = tmp

    const blob = await canvasToBlob(resizedCanvas, JPEG_TYPE, 0.5)

    if (blob.size <= TARGET_BYTES) {
      return blob
    }
  }

  return canvasToBlob(resizedCanvas, JPEG_TYPE, 0.45)
}

export async function optimizeMarketplaceImage(file) {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) {
    throw new Error('Arquivo invalido. Selecione apenas imagens.')
  }

  const image = await readImageFromFile(file)
  const targetSize = pickTargetSize(image.width, image.height)
  const canvas = drawToCanvas(image, targetSize.width, targetSize.height)
  const compressedBlob = await compressCanvas(canvas)

  const fileName = file.name.replace(/\.[^.]+$/, '') || `foto-${Date.now()}`
  const optimizedFile = new File([compressedBlob], `${fileName}.jpg`, {
    type: JPEG_TYPE,
    lastModified: Date.now(),
  })

  const previewDataUrl = await blobToDataUrl(compressedBlob)

  return {
    file: optimizedFile,
    previewDataUrl,
    bytes: compressedBlob.size,
    width: targetSize.width,
    height: targetSize.height,
  }
}
