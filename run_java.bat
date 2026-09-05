@echo off
echo ====================================================
echo  Starting Neuro AI Java Backend Server...
echo ====================================================
if not exist "bin\com\example\chatbot\Main.class" (
    echo Building Java sources...
    javac -encoding UTF-8 -d bin -sourcepath src src/com/example/chatbot/Main.java
)
java -cp bin com.example.chatbot.Main
pause
