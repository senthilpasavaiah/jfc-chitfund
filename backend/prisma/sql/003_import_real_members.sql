-- Real member roster import, generated from the JFC prototype file.
-- Aadhaar numbers are AES-256-GCM encrypted with the production FIELD_ENCRYPTION_KEY
-- before insertion - matches exactly what the live app itself would produce.

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98805 23232', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Ashok kumar Ramsankar', '+91 98805 23232', '+91 98805 23232', 'pfoExIUvZr4NIwit:wdFd7Ie80XoAk0h+WgWgbg==:SbZ9K1XSMzA6LNB2', '6462'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+971 55 110 6915', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Barathan Uthan Malliah', '+971 55 110 6915', '+971 55 110 6915', 'PpgifK9qthNIQkTD:MEgwU0O8TAujSQSwKf7nJA==:fnQ8EVwFfH3moJ0p', '0490'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+65 9852 1956', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Baskararaja Pasavaiah', '+65 9852 1956', '+65 9852 1956', 'y3MZ6RgRNF8UVV3F:Jymxl/EB5g2aUUwtAuiWnw==:Plud4DL4hsOzSkwX', '5051'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+973 3937 0044', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Chandrasekaran Meenatchisundaram', '+973 3937 0044', '+973 3937 0044', 'KDg0qkGo/x1winjC:KB/DLlz8ZWyds/z5KzIWVw==:RCyfUwj4UnJiv+9I', '5106'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

INSERT INTO members (name, mobile_number, aadhaar_encrypted, aadhaar_last4)
VALUES ('Jothiveerarajan C', 'PENDING-1', NULL, NULL)
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98408 99224', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Ganesh Kumar Ramaiya Sundaram', '+91 98408 99224', '+91 98408 99224', 'g/GPc1otY+GRLaJ3:k4yLCf0x6DE23fAUSfNj7g==:HhcIQwhLOv1Tz+V6', '5336'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98840 20680', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Ganeshrajan Veerarajan', '+91 98840 20680', '+91 98840 20680', '1b6vm731RVGlTgRZ:BOUw5j0ATVvvtjM6w8OfaA==:/npZYjwdu31pZK8h', '1966'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+1 (587) 716-2423', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Karthikeyan Thandapani', '+1 (587) 716-2423', '+1 (587) 716-2423', 'eQBKx9wqU76vhDEq:fa74h49S/TFP/nuuBYPE7g==:2DdKsrjJAOPZD5Qf', '0171'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 94443 07614', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Muthuveeranan Nadarajan', '+91 94443 07614', '+91 94443 07614', 'ns1V4rg0ceo9Gosl:4Zn2jMP2D4fUUY9obhtNQA==:93b7tLHfOKjW3Hc9', '2579'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+65 9113 4484', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Nagarajan Uthan Malliah', '+65 9113 4484', '+65 9113 4484', 'r81Ab6J6+gCm5uGl:qJd0l7teHkjMPr3kjZg6mA==:GQVFRGkYKkARxlei', '4244'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 99524 85660', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Navaneetha krishnan', '+91 99524 85660', '+91 99524 85660', 'DMV/EVnDlhW7ApN7:zSeR8slxWEcxgqY/6Q2T3A==:jqHfhX4zD/ixMBlL', '3036'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98840 20683', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Rajamanikkam Meenatchi', '+91 98840 20683', '+91 98840 20683', 'WVSo9N404aQpPboo:rxbIcilJUAtQ+jVNy5QxTg==:bvJevdpx+ir8FOKS', '2234'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 97501 55499', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Rajendran Thangavelu', '+91 97501 55499', '+91 97501 55499', 'Zm5iwh6EjsMi2fUo:wQ+8DCKUnVewpFscwuzqdg==:HuhDUy0NFDBhKKhc', '8097'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98946 80080', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Ramaswamy pandian R', '+91 98946 80080', '+91 98946 80080', 'AznABfOFhDMMk2Uq:ciEBmAsV0Bjh0uaVKaDJEA==:wyijpp7ParcmWNOI', '1056'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 89034 57541', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Ravindran KV', '+91 89034 57541', '+91 89034 57541', '0ZOuyHE/s8cMz4Fg:QOwZAqrDCkFBaksnIT/kwg==:N/CbCw2mQawTdwem', '1501'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+971 50 954 7399', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Rengarajan Shanmugam', '+971 50 954 7399', '+971 50 954 7399', '5D+76IAgUWbTjzP9:Z3Ftwo6xTNrV/rWprv+j9g==:G3lGtOkCCkKiYPEA', '8688'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+1 403 999 7809', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Saravanamanikandan Pandurangan', '+1 403 999 7809', '+1 403 999 7809', 'Yk+RFqztMq/naaxC:i3B4yPmM+o9Xh9RQnzQYYg==:q5J4yOjpkyqcne9d', '2376'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 96771 51868', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Saravanakumar Sundaram', '+91 96771 51868', '+91 96771 51868', '4diSZ510/pUgYXl7:UdCqpZn94JT3H2oJALAbzg==:emd0V96PCQkbVdAE', '4021'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 63815 29614', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Senthil Murugesan', '+91 63815 29614', '+91 63815 29614', 'X4bKTSmMZPW/sre+:1U1pktTs7so9d+qCez5GbQ==:foHRpXEqnFxvIcAX', '9110'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98413 40573', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Senthil prabu Pasavaiah', '+91 98413 40573', '+91 98413 40573', 'RZjEaMQUVPVZ9wZ3:txa/NSfpTZC5qNuw3NHBww==:VyzmGw3JjpnkL4CR', '9315'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+1 551 556 4441', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Sudharshan Nagumallu Nadarajan', '+1 551 556 4441', '+1 551 556 4441', 'RHEwJL1YIxpKDABg:zE4eXBlJGKRh+19FSWeRZA==:JP40zF3sa5llmYT8', '6356'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+968 91720250', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Sundar Veerappan', '+968 91720250', '+968 91720250', 'kLAxbW8BeW87Qv43:V/dQyfAfe5Q01greEf4kQg==:5ThXQ4FapdoKkzvU', '6951'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 97893 21391', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Thandapani Kalyani', '+91 97893 21391', '+91 97893 21391', 'dmgaeTGcw38srSRa:QYaFIKmX3+BgzNl6ShvtKg==:CMkCrGFIPj6SoS2n', '9223'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 78007 59324', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Udhaya kumar Karupaswami', '+91 78007 59324', '+91 78007 59324', 'b5JWxzA3Reo0nBNV:pchnlyosNyzteDwvx1BTpg==:DYYhjNdFkaglG5Ar', '4126'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 95000 74571', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Veeramani Veerarajan', '+91 95000 74571', '+91 95000 74571', '1+du8bvMWeiUWCBE:oipZ7ayWunBmRYtCxkncRQ==:T2o2Hf6dUgenBU+h', '9780'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 90032 71255', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Veeranan Veerappan', '+91 90032 71255', '+91 90032 71255', 'wzYurJ+diC2mRDe3:5gZOkuLBdXwopvREJExReA==:ujjxB2RO5l1lfChz', '6725'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 96889 32795', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Vijayabalu Poobalan', '+91 96889 32795', '+91 96889 32795', 'NnvOJ6YO0NH+t2vb:PWUAc0CRdCWMdr6xriG/Hg==:wjThkI6Y8Po0NmeH', '3988'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

WITH new_user AS (
  INSERT INTO users (phone, role) VALUES ('+91 98869 13229', 'MEMBER') RETURNING id
)
INSERT INTO members (user_id, name, mobile_number, whatsapp_number, aadhaar_encrypted, aadhaar_last4)
SELECT id, 'Vijayakumar Veerarjan', '+91 98869 13229', '+91 98869 13229', 'g7XIoLeuXk18PsVG:UWiDzIpn66ZPbCZiX5GSNg==:xrocRLqoNEa+cJrs', '0705'
FROM new_user
ON CONFLICT (mobile_number) DO NOTHING;

