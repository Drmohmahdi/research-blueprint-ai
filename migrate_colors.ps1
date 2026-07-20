$files = @(
  'src\components\TitleAnalyzer.tsx',
  'src\components\SimulationLab.tsx',
  'src\components\SampleSizeCalc.tsx',
  'src\components\DataInspector.tsx',
  'src\components\PreRegistration.tsx',
  'src\components\FieldMonitoring.tsx',
  'src\components\LiteratureSynthesizer.tsx',
  'src\components\PrismaBuilder.tsx'
)

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8

    # Card/panel backgrounds
    $content = $content -replace 'bg-white dark:bg-\[#0c0c0f\]', 'bg-[var(--ds-surface-primary)]'
    $content = $content -replace 'bg-\[#ffffff\] dark:bg-\[#09090b\]', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'dark:bg-zinc-950\b', 'bg-[var(--ds-surface-secondary)]'

    # Input/secondary surface backgrounds
    $content = $content -replace 'bg-zinc-50 dark:bg-zinc-900\b', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'bg-zinc-50 dark:bg-zinc-950\b', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'bg-zinc-100 dark:bg-zinc-900\b', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'bg-white dark:bg-zinc-950\b', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'bg-white dark:bg-zinc-800\b', 'bg-[var(--ds-surface-secondary)]'
    $content = $content -replace 'bg-zinc-100 dark:bg-zinc-800\b', 'bg-[var(--ds-surface-secondary)]'

    # Borders
    $content = $content -replace 'border-zinc-200 dark:border-zinc-800\b', 'border-[var(--ds-border-subtle)]'
    $content = $content -replace 'border-zinc-100 dark:border-zinc-900\b', 'border-[var(--ds-border-subtle)]'
    $content = $content -replace 'border-zinc-200 dark:border-zinc-700\b', 'border-[var(--ds-border-subtle)]'
    $content = $content -replace 'dark:border-zinc-800/60\b', 'border-[var(--ds-border-subtle)]'

    # Text colors
    $content = $content -replace 'text-zinc-900 dark:text-zinc-50\b', 'text-[var(--ds-text-primary)]'
    $content = $content -replace 'text-zinc-900 dark:text-zinc-100\b', 'text-[var(--ds-text-primary)]'
    $content = $content -replace 'text-zinc-800 dark:text-zinc-200\b', 'text-[var(--ds-text-primary)]'
    $content = $content -replace 'text-zinc-500 dark:text-zinc-400\b', 'text-[var(--ds-text-secondary)]'
    $content = $content -replace 'text-zinc-600 dark:text-zinc-400\b', 'text-[var(--ds-text-secondary)]'
    $content = $content -replace 'text-zinc-700 dark:text-zinc-300\b', 'text-[var(--ds-text-secondary)]'
    $content = $content -replace 'text-zinc-400\b', 'text-[var(--ds-text-muted)]'

    # Upgrade rounded-xl to rounded-2xl on card containers only (those with p- suffix)
    $content = $content -replace 'rounded-xl (p-[0-9])', 'rounded-2xl $1'

    Set-Content $file $content -NoNewline -Encoding UTF8
    Write-Host "Updated: $file"
  } else {
    Write-Host "Skipped (not found): $file"
  }
}

Write-Host "Done."
