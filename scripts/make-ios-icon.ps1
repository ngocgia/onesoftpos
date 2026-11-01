# Tao icon iOS 1024x1024 (nen trang dac, khong alpha) tu icon Android 512px.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = 'D:\codeDuAn\thichgapos\android-pos\app\src\main\res\drawable\app_icon.png'
$outputPath = 'D:\codeDuAn\thichgapos\ios-pos\OnesoftPOS\Assets.xcassets\AppIcon.appiconset\AppIcon1024.png'

$src = [System.Drawing.Image]::FromFile($sourcePath)
$bmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($src, 0, 0, 1024, 1024)
$g.Dispose()
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$src.Dispose()
$bmp.Dispose()

$saved = Get-Item $outputPath
Write-Output ("Icon written: " + $outputPath + " (" + $saved.Length + " bytes)")
