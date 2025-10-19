// utils.js (optional - for future utility functions)
import GLib from 'gi://GLib';

export const executeCommand = (command) => {
    try {
        const [success, stdout, stderr] = GLib.spawn_command_line_sync(command);
        if (success) {
            return String.fromCharCode.apply(null, stdout);
        }
        return null;
    } catch (e) {
        console.error('Command execution error:', e);
        return null;
    }
};

export const isNordVPNInstalled = () => {
    try {
        GLib.spawn_command_line_sync('which nordvpn');
        return true;
    } catch (e) {
        return false;
    }
};