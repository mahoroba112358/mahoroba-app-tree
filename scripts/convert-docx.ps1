# scripts/convert-docx.ps1
# Convert D:\仕様書-説明書\*.docx to mahoroba-app-tree/docs/pdf/*.pdf
# Usage: npm run convert-docs (called from package.json)
# Requires: Microsoft Word (uses Word COM automation)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Source = 'D:\' + [char]0x4ED5 + [char]0x69D8 + [char]0x66F8 + '-' + [char]0x8AAC + [char]0x660E + [char]0x66F8
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Split-Path -Parent $ScriptDir
$DestDir = Join-Path $Project 'docs\pdf'

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Error ('Source folder not found: ' + $Source)
    exit 1
}

if (-not (Test-Path -LiteralPath $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

$DocxFiles = Get-ChildItem -LiteralPath $Source -Filter '*.docx' -File
if ($DocxFiles.Count -eq 0) {
    Write-Host 'No .docx files found.'
    exit 0
}

Write-Host ('Files to convert: ' + $DocxFiles.Count)

$Word = $null
try {
    $Word = New-Object -ComObject Word.Application
    $Word.Visible = $false
    $Word.DisplayAlerts = 0  # wdAlertsNone

    foreach ($Docx in $DocxFiles) {
        $PdfName = [System.IO.Path]::ChangeExtension($Docx.Name, '.pdf')
        $PdfPath = Join-Path $DestDir $PdfName

        Write-Host ('  -> ' + $PdfName)

        $Doc = $Word.Documents.Open($Docx.FullName, $false, $true)
        try {
            # Use ExportAsFixedFormat (more reliable than SaveAs for PDF in PS 5.1)
            # ExportFormat 17 = wdExportFormatPDF
            $Doc.ExportAsFixedFormat($PdfPath, 17)
        }
        finally {
            $Doc.Close($false)
        }
    }

    Write-Host ('Done. Output: ' + $DestDir)
}
finally {
    if ($Word) {
        $Word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Word) | Out-Null
    }
}
