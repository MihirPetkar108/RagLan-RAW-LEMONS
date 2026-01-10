CREATE USER:
POST
http://localhost:8080/api/users
Body:
{"name":"alice","role":"engineer","password":"s3cret"}

Response: 201 with { \_id, name, role } — use that \_id as userId.
LOGIN:
POST
http://localhost:8080/api/login
Body:
{"name":"alice","password":"s3cret"}

Response contains user.\_id — use it.
Create/append chat (recommended: include userId)
POST
http://localhost:8080/api/chat
Body:
{
"threadId": "t1",
"message": "What is engineering",
"name": "james",
"role": "engineering",
"userId": "<alice's \_id>"
}

Fetch that user's thread
GET http://localhost:8080/api/thread/t5?userId=64a1f2...yourUserIdHere

Admin, Engineer, HR, Research
