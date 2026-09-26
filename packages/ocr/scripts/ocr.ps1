<#
.SYNOPSIS
  Tether OCR bridge (Prompt 11 §1, PRD HR-1/HR-13, AC-P11-01).

.DESCRIPTION
  Keep-alive helper that exposes Windows.Media.Ocr (WinRT) over a line
  protocol: each request is one line of base64 PNG on stdin; each response is
  one JSON line on stdout: {"ok":true,"lines":[{text,bbox:{x,y,w,h},confidence}]}
  or {"ok":false,"error":"..."}.

  Runs entirely locally. No network access. Ships inside the @tether/ocr
  package (daemon-only). Error messages never echo image bytes or OCR text
  (PRD HR-7).
#>

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

function Write-Line([string]$s) {
    [Console]::Out.WriteLine($s)
    [Console]::Out.Flush()
}

# --- WinRT IAsyncOperation -> Task bridge (PowerShell 5.1 desktop) ----------
Add-Type -AssemblyName System.Runtime.WindowsRuntime 2>$null

$script:asTaskGeneric = $null
try {
    $script:asTaskGeneric =
        [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } |
        Select-Object -First 1
} catch {
    $script:asTaskGeneric = $null
}

function Await([object]$WinRtOperation, [type]$ResultType) {
    if ($null -eq $script:asTaskGeneric) {
        throw 'WinRT async bridge unavailable'
    }
    $asTask = $script:asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtOperation))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

# --- Engine bootstrap --------------------------------------------------------
try {
    # Load WinRT runtime types (Windows 10+; PowerShell 5.1 desktop)
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.DataWriter, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]

    $script:engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $script:engine) {
        # No OCR language pack installed -> permanent degrade signal
        Write-Line 'UNAVAILABLE'
        exit 0
    }

    Write-Line 'READY'
} catch {
    Write-Line 'UNAVAILABLE'
    exit 0
}

function New-Result([int]$Id, [object[]]$Lines) {
    (@{ id = $Id; ok = $true; lines = $Lines } | ConvertTo-Json -Depth 5 -Compress)
}

function New-Error([int]$Id, [string]$Msg) {
    (@{ id = $Id; ok = $false; error = $Msg } | ConvertTo-Json -Depth 3 -Compress)
}

# --- Request loop ------------------------------------------------------------
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $req = $null
    try { $req = $line | ConvertFrom-Json } catch { continue }
    if ($null -eq $req -or -not $req.PSObject.Properties['id'] -or -not $req.PSObject.Properties['image']) { continue }

    $id = 0
    try { $id = [int]$req.id } catch { continue }

    try {
        $bytes = [Convert]::FromBase64String($req.image)

        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $writer = New-Object Windows.Storage.Streams.DataWriter($stream)
        $writer.WriteBytes($bytes)
        Await ($writer.StoreAsync()) ([uint32]) | Out-Null
        $writer.FlushAsync() | Out-Null
        $writer.DetachStream() | Out-Null
        $stream.Seek(0) | Out-Null

        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

        $ocrResult = Await ($script:engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

        $lines = @()
        foreach ($l in $ocrResult.Lines) {
            # NOTE: the PS 5.1 WinRT projection of OcrLine has no BoundingRect
            # (only Text + Words). Compute the line bbox from word rects.
            $minX = [double]::MaxValue; $minY = [double]::MaxValue
            $maxR = [double]::MinValue; $maxB = [double]::MinValue
            foreach ($w in $l.Words) {
                $r = $w.BoundingRect
                if ($r.X -lt $minX) { $minX = $r.X }
                if ($r.Y -lt $minY) { $minY = $r.Y }
                if (($r.X + $r.Width) -gt $maxR) { $maxR = $r.X + $r.Width }
                if (($r.Y + $r.Height) -gt $maxB) { $maxB = $r.Y + $r.Height }
            }
            if ($minX -eq [double]::MaxValue) { continue }
            $lines += @{
                text       = $l.Text
                bbox       = @{ x = [int][math]::Floor($minX); y = [int][math]::Floor($minY); w = [int][math]::Ceiling($maxR - $minX); h = [int][math]::Ceiling($maxB - $minY) }
                confidence = 1.0
            }
        }

        Write-Line (New-Result $id $lines)
    } catch {
        Write-Line (New-Error $id 'ocr-failed')
    }
}
