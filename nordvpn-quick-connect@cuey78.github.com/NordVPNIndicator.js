// NordVPNIndicator.js
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export class NordVPNIndicator extends PanelMenu.Button {
    constructor() {
        super(0, "NordVPN Indicator", false);

        this.buttonText = new St.Label({
            text: 'NordVPN',
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.buttonText);
        
        this._updateStatus();
    }

    _buildMenu() {
        this.menu.removeAll();
        
        // Status section
        const statusSection = new PopupMenu.PopupMenuSection();
        const statusItem = new PopupMenu.PopupMenuItem('Checking status...');
        statusSection.addMenuItem(statusItem);
        this.menu.addMenuItem(statusSection);
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Connect section
        const connectSection = new PopupMenu.PopupMenuSection();
        const connectHeader = new PopupMenu.PopupMenuItem('Connect to Country:');
        connectHeader.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        connectHeader.setOrnament(PopupMenu.Ornament.NONE);
        connectHeader.sensitive = false;
        connectSection.addMenuItem(connectHeader);
        
        // Get countries and add to menu
        const countries = this._getCountries();
        countries.forEach(country => {
            const countryItem = new PopupMenu.PopupMenuItem(country);
            countryItem.connect('activate', () => {
                this._connectToCountry(country);
            });
            connectSection.addMenuItem(countryItem);
        });
        
        this.menu.addMenuItem(connectSection);
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Disconnect section
        const disconnectSection = new PopupMenu.PopupMenuSection();
        const disconnectItem = new PopupMenu.PopupMenuItem('Disconnect');
        disconnectItem.connect('activate', () => {
            this._disconnect();
        });
        disconnectSection.addMenuItem(disconnectItem);
        this.menu.addMenuItem(disconnectSection);
        
        // Update status initially
        this._updateStatusItem(statusItem);
    }

    _getCountries() {
        try {
            const [success, stdout, stderr] = GLib.spawn_command_line_sync('nordvpn countries');
            if (success) {
                const output = String.fromCharCode.apply(null, stdout);
                // Parse the tabular output and extract country names
                const countries = output.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.split(/\s+/).filter(word => word))
                    .flat()
                    .filter(country => country && !country.includes('_') && country.length > 2);
                
                return countries.slice(0, 20); // Limit to first 20 countries for menu size
            }
        } catch (e) {
            console.error('Error getting countries:', e);
        }
        return ['United_States', 'United_Kingdom', 'Germany', 'Japan', 'Australia'];
    }

    _updateStatusItem(statusItem) {
        try {
            const [success, stdout, stderr] = GLib.spawn_command_line_sync('nordvpn status');
            if (success) {
                const status = String.fromCharCode.apply(null, stdout);
                if (status.includes('Connected')) {
                    const countryMatch = status.match(/Country: (.+)/);
                    const cityMatch = status.match(/City: (.+)/);
                    const statusText = countryMatch && cityMatch 
                        ? `Connected to ${countryMatch[1]}, ${cityMatch[1]}`
                        : 'Connected';
                    statusItem.label.text = statusText;
                    this.buttonText.set_text('VPN ✓');
                } else {
                    statusItem.label.text = 'Disconnected';
                    this.buttonText.set_text('NordVPN');
                }
            }
        } catch (e) {
            statusItem.label.text = 'Status Error';
            this.buttonText.set_text('VPN ?');
        }
    }

    _connectToCountry(country) {
        try {
            GLib.spawn_command_line_async(`nordvpn connect ${country}`);
            // Update status after a delay to allow connection
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                this._updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            console.error('Error connecting to VPN:', e);
        }
    }

    _disconnect() {
        try {
            GLib.spawn_command_line_async('nordvpn disconnect');
            // Update status after a delay to allow disconnection
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this._updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            console.error('Error disconnecting VPN:', e);
        }
    }

    _updateStatus() {
        this._buildMenu(); // Rebuild menu to update status
    }

    stop() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
        }
        this._timeout = undefined;
        this.menu.removeAll();
    }
}
