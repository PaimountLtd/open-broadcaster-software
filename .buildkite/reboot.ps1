# To avoid hanging zombie processes it's required to reboot the PC after tests run.

# The buildkite-agent process must be gracefully stoped
# If we stop process by simply killing it than the Buildkit srerver will not receive a `disconnect` message
# That causes multiple hanging agents

# The buildkite-agent process can be killed via sending an `SIGTERM` signal
# https://buildkite.com/docs/agent/v3#signal-handling
# Hovewer this aproach doesn't work in Windows
# Workaround here is send a Ctrl+C keys to the buildkite-agent window
#$agentPid = (Get-Process | Where-Object {$_.ProcessName -eq "buildkite-agent"}).Id
#$wshell = New-Object -ComObject wscript.shell;
#$wshell.AppActivate($agentPid)
#Sleep 1
#$wshell.SendKeys("^(C)")
#
## give bulidekite-agent some time for gracefully exit and reboot the PC
#Sleep 5
#Restart-Computer;
# Sleep 5;

Register-ScheduledJob -Name RestartPC -scriptblock {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show('Hello')
  Unregister-ScheduledJob -Name RestartPC
} -Trigger (New-JobTrigger -Once -At (Get-Date).AddSeconds(5))

Restart-Computer
shutdown -r -t (Get-Date).AddSeconds(5) /d p:4:1
shutdown /r /t 10 /c "Reboot after CI Job finished" /f /d p:4:1

