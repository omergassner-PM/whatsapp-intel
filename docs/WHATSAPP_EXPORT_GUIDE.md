# How to Export WhatsApp Group Chat

This guide is for the weekly export of the intelligence group chat.

## Steps (Takes ~30 seconds)

### On iPhone

1. Open the WhatsApp group chat
2. Tap the **group name** at the top of the screen
3. Scroll down and tap **Export Chat**
4. Select **Include Media** (this captures shared images and documents)
5. Choose how to send the file:
   - **Save to Files** → Save to a known folder
   - **Email** → Send to yourself or the ingestion email
   - **AirDrop** → Transfer directly to a Mac

### On Android

1. Open the WhatsApp group chat
2. Tap the **⋮ (three dots)** menu in the top right
3. Tap **More** → **Export chat**
4. Select **Include Media**
5. Choose how to send the file:
   - **Google Drive** → Save to a shared folder
   - **Email** → Send to yourself
   - **Files** → Save locally

## What Gets Exported

- A `.zip` file containing:
  - `_chat.txt` — All messages with timestamps and sender names
  - Media files (images, PDFs, documents shared in the group)

## Weekly Routine

| Day       | Action                                        |
|-----------|-----------------------------------------------|
| Sunday    | Export the group chat (include media)          |
| Sunday    | Upload the .zip file via the webapp            |
| Monday    | System processes overnight, digest is ready    |

## Upload to the System

### Option A: Web Upload (Recommended)

1. Open the webapp in your browser (requires VPN)
2. Go to the **Upload** page
3. Drag and drop the `.zip` file
4. Wait for the confirmation message
5. The system will process new content automatically

### Option B: Folder Drop

1. Connect to the company server via VPN
2. Copy the `.zip` file to the designated `exports/` folder
3. The system picks it up automatically on the next processing cycle

## Important Notes

- You can export the **full chat** every time — the system automatically detects and skips messages it has already processed
- If an export fails or is interrupted, just try again
- Media files (images, PDFs) are stored but currently only text messages and article links are processed
- If you have any issues, contact Omer
