# scripts/convert-docx.ps1
# D:\仕様書-説明書\*.docx を mahoroba-app-tree/docs/pdf/*.pdf に変換
# 利用: npm run convert-docs（package.json から呼び出し）
# 前提: Microsoft Word がローカルにインストールされていること

$ErrorActionPreference = 'Stop'

$Source = 'D:\仕様書-説明書'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Project = Split-Path -Parent $ScriptDir
$DestDir = Join-Path $Project 'docs\pdf'

if (-not (Test-Path $Source)) {
    Write-Error "ソースフォルダが存在しません: $Source"
    exit 1
}

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

$DocxFiles = Get-ChildItem -Path $Source -Filter '*.docx' -File
if ($DocxFiles.Count -eq 0) {
    Write-Host '変換対象の .docx が見つかりません。'
    exit 0
}

Write-Host ("変換対象: {0} ファイル" -f $DocxFiles.Count)

$Word = $null
try {
    $Word = New-Object -ComObject Word.Application
    $Word.Visible = $false
    $Word.DisplayAlerts = 0  # wdAlertsNone

    foreach ($Docx in $DocxFiles) {
        $PdfName = [System.IO.Path]::ChangeExtension($Docx.Name, '.pdf')
        $PdfPath = Join-Path $DestDir $PdfName

        Write-Host ("  -> {0}" -f $PdfName)

        $Doc = $Word.Documents.Open($Docx.FullName, $false, $true)  # ConfirmConversions, ReadOnly
        try {
            $Doc.SaveAs([ref]$PdfPath, [ref]17)  # 17 = wdFormatPDF
        }
        finally {
            $Doc.Close($false)
        }
    }

    Write-Host ('変換完了: {0}' -f $DestDir)
}
finally {
    if ($Word) {
        $Word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Word) | Out-Null
    }
}
