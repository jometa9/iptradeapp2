# Script para convertir PNG a BMP de 24 bits para NSIS
param(
    [string]$InputPath = "public\sidebar.png",
    [string]$OutputPath = "public\installer-sidebar.bmp",
    [int]$Width = 164,
    [int]$Height = 314
)

Add-Type -AssemblyName System.Drawing

Write-Host "Convirtiendo imagen a BMP de 24 bits para NSIS..." -ForegroundColor Cyan
Write-Host "Entrada: $InputPath" -ForegroundColor Gray
Write-Host "Salida: $OutputPath" -ForegroundColor Gray
Write-Host "Tamanio: ${Width}x${Height}" -ForegroundColor Gray

try {
    # Cargar la imagen original
    $inputImage = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
    Write-Host "Imagen cargada: $($inputImage.Width)x$($inputImage.Height)" -ForegroundColor Green
    
    # Crear un nuevo bitmap con el tamaño exacto requerido
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    
    # Crear un objeto Graphics para dibujar
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Configurar calidad de renderizado
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Llenar el fondo de blanco (sin transparencia)
    $graphics.Clear([System.Drawing.Color]::White)
    
    # Calcular el escalado para mantener aspecto
    $scaleX = $Width / $inputImage.Width
    $scaleY = $Height / $inputImage.Height
    $scale = [Math]::Min($scaleX, $scaleY)
    
    $scaledWidth = [int]($inputImage.Width * $scale)
    $scaledHeight = [int]($inputImage.Height * $scale)
    
    # Centrar la imagen
    $x = [int](($Width - $scaledWidth) / 2)
    $y = [int](($Height - $scaledHeight) / 2)
    
    # Dibujar la imagen escalada y centrada
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $scaledWidth, $scaledHeight)
    $graphics.DrawImage($inputImage, $destRect, 0, 0, $inputImage.Width, $inputImage.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    Write-Host "Imagen procesada y centrada" -ForegroundColor Green
    
    # Guardar como BMP de 24 bits
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    
    Write-Host "BMP de 24 bits creado exitosamente: $OutputPath" -ForegroundColor Green
    
    # Mostrar información del archivo
    $fileInfo = Get-Item $OutputPath
    Write-Host "Tamanio del archivo: $([Math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor Gray
    
    # Limpiar recursos
    $graphics.Dispose()
    $bitmap.Dispose()
    $inputImage.Dispose()
    
    exit 0
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}

