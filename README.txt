#How to start application#
    First, you need to do clone this Project.

    command:
    git clone <the project path(http)>
    username xinainovation
    password 秘密鍵

    Compleat clone.

#How to do daemon the application

    needly Forever

    command:
    npm install forever -g
    forever -w start <appname>

    forever list (you can show what it is running.)

#How to do release your application

    needly install negrok
    *you can access your IP from outside with 'negrok'. 

    refer↓
    https://dashboard.ngrok.com/get-started/setup/linux
    
    command:
    screen <- create new session. it can access from outside if this session was closed.
    ngrok http <port num>
    [check your https url and copy it]
    [Ctrl + a & d]

    Compleat


       