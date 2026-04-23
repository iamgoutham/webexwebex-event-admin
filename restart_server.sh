#!/usr/bin/bash
source /etc/webexadmin.env
. /etc/webexadmin.env
export DATABASE_URL='mysql://root:Vrind1v2n!@localhost:3306/webex_admin'
PARTICIPANT_MAP_LIST=r'"[
            {"sheet_id": "1_79XF9_lgAkTdznWjjoTHX_wlK_eYbOpWpbjVK6Lvhg", "email_column_name": "Email", "phone_column_name": "Contact Phone (WhatsApp)"},
            {"sheet_id"A: "1d7QHn-XXbl9ix2K9FhFYNvtSHh4GgALIjEFEk0Y3vkY", "email_column_name": "Email of student or studentâ\x80\x99s parent", "phone_column_name": "WhatsApp number"}]'
git pull
npm run build
sudo systemctl restart webexadmin

#UPDATE User  SET role = 'SUPER_ADMIN'  WHERE email = 'goutham.puppala@gmail.com';

