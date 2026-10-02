param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [ValidateSet("docx", "pptx")]
  [string]$Kind
)

$ErrorActionPreference = "Stop"

function Release-ComObject {
  param([object]$ComObject)

  if ($null -ne $ComObject) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ComObject)
  }
}

switch ($Kind) {
  "docx" {
    $word = $null
    $document = $null

    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $word.DisplayAlerts = 0

      $readOnly = $true
      $isVisible = $false
      $document = $word.Documents.Open($InputPath, [ref]$false, [ref]$readOnly, [ref]$false, "", "", [ref]$false, "", "", 0, "", [ref]$isVisible)

      $pdfFormat = 17
      $document.SaveAs([ref]$OutputPath, [ref]$pdfFormat)
    }
    finally {
      if ($null -ne $document) {
        $document.Close([ref]$false)
      }
      if ($null -ne $word) {
        $word.Quit()
      }

      Release-ComObject -ComObject $document
      Release-ComObject -ComObject $word
      [GC]::Collect()
      [GC]::WaitForPendingFinalizers()
    }
  }

  "pptx" {
    $powerPoint = $null
    $presentation = $null

    try {
      $powerPoint = New-Object -ComObject PowerPoint.Application
      $presentation = $powerPoint.Presentations.Open($InputPath, $true, $false, $false)

      $ppSaveAsPDF = 32
      $presentation.SaveAs($OutputPath, $ppSaveAsPDF)
    }
    finally {
      if ($null -ne $presentation) {
        $presentation.Close()
      }
      if ($null -ne $powerPoint) {
        $powerPoint.Quit()
      }

      Release-ComObject -ComObject $presentation
      Release-ComObject -ComObject $powerPoint
      [GC]::Collect()
      [GC]::WaitForPendingFinalizers()
    }
  }
}

if (-not (Test-Path -LiteralPath $OutputPath)) {
  throw "PDF conversion failed: output file was not created."
}
