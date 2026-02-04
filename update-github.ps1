# Quick script to update GitHub Pages
# Run this when you want to publish your local changes

Write-Host "🚀 Updating GitHub Pages..." -ForegroundColor Cyan

# Stage all changes
git add .

# Get commit message from user
$message = Read-Host "Enter commit message (or press Enter for default)"

if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update Lyrics Puzzle game"
}

# Commit changes
git commit -m $message

# Push to GitHub
Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
git push

Write-Host "✅ Done! Your changes will be live in 1-2 minutes." -ForegroundColor Green
Write-Host "🌐 Check: https://YOUR_USERNAME.github.io/lyrics-figure/" -ForegroundColor Cyan
