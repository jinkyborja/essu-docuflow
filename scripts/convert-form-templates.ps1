$ErrorActionPreference = 'Stop'
$formsDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\static\forms'))
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    foreach ($source in Get-ChildItem -LiteralPath $formsDirectory -Filter '*.docx' -File) {
        $pdfName = ($source.Name -replace '(\.docx)+$', '') + '.pdf'
        $outputPath = Join-Path $formsDirectory $pdfName
        $document = $null
        try {
            $document = $word.Documents.Open($source.FullName, $false, $true, $false)
            $document.ExportAsFixedFormat($outputPath, 17)
            Write-Output $pdfName
        } finally {
            if ($null -ne $document) {
                $document.Close(0)
                [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
            }
        }
    }
} finally {
    if ($null -ne $word) {
        $word.Quit(0)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
}
