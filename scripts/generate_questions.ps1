param(
  [string]$InputPath = "downloadQuestionAll.doc",
  [string]$OutputPath = "questions.cleaned.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$chapters = @(
  '政府採購法之履約管理及驗收',
  '採購契約',
  '投標須知及招標文件製作',
  '電子採購實務',
  '政府採購法之罰則及附則',
  '道德規範及違法處置',
  '最有利標及評選優勝廠商',
  '政府採購法之爭議處理',
  '工程及技術服務採購作業',
  '政府採購全生命週期概論',
  '政府採購法之總則、招標及決標',
  '底價及價格分析',
  '財物及勞務採購作業',
  '錯誤採購態樣'
)

function Parse-MultipleChoiceOptions {
  param(
    [string]$Text
  )

  $matches = [regex]::Matches($Text, '\((\d)\)')
  if ($matches.Count -eq 0) {
    return @{
      questionText = $Text.Trim()
      options = @()
    }
  }

  $questionText = $Text.Substring(0, $matches[0].Index).Trim()
  $options = @()

  for ($i = 0; $i -lt $matches.Count; $i++) {
    $label = $matches[$i].Groups[1].Value
    $start = $matches[$i].Index + $matches[$i].Length
    $end = if ($i -lt $matches.Count - 1) { $matches[$i + 1].Index } else { $Text.Length }
    $optionText = $Text.Substring($start, $end - $start).Trim()
    $options += @{
      label = $label
      text = $optionText
    }
  }

  return @{
    questionText = $questionText
    options = $options
  }
}

Add-Type -AssemblyName System.Windows.Forms
$rtb = New-Object System.Windows.Forms.RichTextBox
$rtb.Rtf = Get-Content -Path $InputPath -Raw
$lines = ($rtb.Text -split "`r?`n") |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -ne '' }

$chapterSet = [System.Collections.Generic.HashSet[string]]::new()
foreach ($chapter in $chapters) {
  [void]$chapterSet.Add($chapter)
}

$questions = New-Object System.Collections.Generic.List[object]
$currentChapter = $null
$currentType = $null

foreach ($line in $lines) {
  if ($chapterSet.Contains($line)) {
    $currentChapter = $line
    continue
  }

  if ($line -eq '是非題') {
    $currentType = 'true_false'
    continue
  }

  if ($line -eq '選擇題') {
    $currentType = 'multiple_choice'
    continue
  }

  if ($line -notmatch '^(\d+)\t([^\t]+)\t(.+)$') {
    continue
  }

  if (-not $currentChapter -or -not $currentType) {
    continue
  }

  $sourceNo = [int]$matches[1]
  $answerRaw = $matches[2].Trim()
  $body = $matches[3].Trim()

  if ($currentType -eq 'true_false') {
    $bodyParts = $body -split "`t"
    $questionText = $bodyParts[0].Trim()
    $options = @(
      @{ label = 'O'; text = 'O' },
      @{ label = 'X'; text = 'X' }
    )
    $answer = if ($answerRaw -eq 'O') { 'O' } else { 'X' }
  } else {
    $parsed = Parse-MultipleChoiceOptions -Text $body
    $questionText = $parsed.questionText
    $options = $parsed.options
    $answer = $answerRaw
  }

  $questions.Add([pscustomobject][ordered]@{
    id = ("{0}-{1}-{2}" -f $currentChapter, $currentType, $sourceNo)
    chapter = $currentChapter
    type = $currentType
    sourceNo = $sourceNo
    questionText = $questionText
    options = $options
    answer = $answer
  })
}

$chapterCatalog = @{}
foreach ($chapter in $chapters) {
  $chapterCatalog[$chapter] = @{
    true_false = @()
    multiple_choice = @()
  }
}

foreach ($question in $questions) {
  $chapterCatalog[$question.chapter][$question.type] += $question.id
}

$subjectBlueprints = [ordered]@{
  "總論及法規課程" = @{
    timeLimitMinutes = 80
    scoring = @{
      true_false = 1
      multiple_choice = 2
    }
    chapters = @(
      @{ chapter = "政府採購全生命週期概論"; true_false = 2; multiple_choice = 4 },
      @{ chapter = "政府採購法之總則、招標及決標"; true_false = 14; multiple_choice = 28 },
      @{ chapter = "政府採購法之履約管理及驗收"; true_false = 2; multiple_choice = 4 },
      @{ chapter = "政府採購法之罰則及附則"; true_false = 5; multiple_choice = 10 }
    )
  }
  "實務課程" = @{
    timeLimitMinutes = 80
    scoring = @{
      true_false = 1
      multiple_choice = 2
    }
    chapters = @(
      @{ chapter = "工程及技術服務採購作業"; true_false = 6; multiple_choice = 12 },
      @{ chapter = "財物及勞務採購作業"; true_false = 6; multiple_choice = 12 },
      @{ chapter = "最有利標及評選優勝廠商"; true_false = 6; multiple_choice = 12 },
      @{ chapter = "電子採購實務"; true_false = 6; multiple_choice = 12 }
    )
  }
  "其他課程" = @{
    timeLimitMinutes = 80
    scoring = @{
      true_false = 1
      multiple_choice = 2
    }
    chapters = @(
      @{ chapter = "錯誤採購態樣"; true_false = 2; multiple_choice = 4 },
      @{ chapter = "投標須知及招標文件製作"; true_false = 4; multiple_choice = 8 },
      @{ chapter = "採購契約"; true_false = 4; multiple_choice = 8 },
      @{ chapter = "底價及價格分析"; true_false = 3; multiple_choice = 6 },
      @{ chapter = "政府採購法之爭議處理"; true_false = 4; multiple_choice = 8 },
      @{ chapter = "道德規範及違法處置"; true_false = 2; multiple_choice = 4 }
    )
  }
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  sourceFile = (Resolve-Path $InputPath).Path
  chapterCatalog = $chapterCatalog
  subjectBlueprints = $subjectBlueprints
  questions = $questions
}

$json = $payload | ConvertTo-Json -Depth 8
$outputFile = Join-Path -Path (Get-Location) -ChildPath $OutputPath
$outputJsFile = [System.IO.Path]::ChangeExtension($outputFile, ".js")
[System.IO.File]::WriteAllText($outputFile, $json, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($outputJsFile, "window.__QUESTION_DATA__ = $json;", [System.Text.Encoding]::UTF8)

Write-Output "Generated $OutputPath with $($questions.Count) questions."
