THE SUN - README

1. Change database / use another hotel

If you want this app to connect to another Supabase project,
edit this file only:

supabase-config.js

Change:
- url
- anonKey

Do not put private keys in that file.


2. Backup setup

The database backup uses:
- supabase-config.js for the project URL
- backup-secret.txt for the private backup key

Before running backup:

1. Copy this file:

backup-secret.example.txt

2. Rename the copy to:

backup-secret.txt

3. Open backup-secret.txt and paste your Supabase service_role key:

backupKey = "YOUR_SUPABASE_SERVICE_ROLE_KEY"

Important:
- keep this key private
- do NOT put it into supabase-config.js


3. Manual backup

Open PowerShell in this project folder, then run:

node .\backup-supabase.js

Default backup output folder:

backups\

Each backup exports:
- JSON files
- CSV files
- manifest.json


4. Manual backup to custom folder

Example:

node .\backup-supabase.js --backup-folder "D:\HotelBackups\TheSun"


5. Turn on automatic daily backup

Open PowerShell in this project folder, then run:

powershell -NoProfile -ExecutionPolicy Bypass -File .\register-daily-backup.ps1

Default schedule:
- every day at 02:00 AM

Example with different time:

powershell -NoProfile -ExecutionPolicy Bypass -File .\register-daily-backup.ps1 -Time "23:30"

Example with custom backup folder:

powershell -NoProfile -ExecutionPolicy Bypass -File .\register-daily-backup.ps1 -Time "23:30" -BackupFolder "D:\HotelBackups\TheSun"


6. Stop automatic backup

Temporarily disable:

Disable-ScheduledTask -TaskName "TheSun Supabase Backup"

Enable again:

Enable-ScheduledTask -TaskName "TheSun Supabase Backup"

Remove completely:

Unregister-ScheduledTask -TaskName "TheSun Supabase Backup" -Confirm:$false


7. Important

To fully protect this system, back up both:
- this project folder
- the Supabase database

Copying the folder alone does not back up your database.
