import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export default class NordVPNExtension {
    constructor(metadata) {
        this._metadata = metadata;
    }

    enable() {
        log('=== NordVPN Extension: Enabling ===');
        
        // Create panel button
        this._button = new PanelMenu.Button(0.0, 'NordVPN Indicator');
        
        // Add icon to button instead of text label
        const iconPath = `${this._metadata.path}/nord.png`;
        const iconFile = Gio.File.new_for_path(iconPath);
        
        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: iconFile }),
            style_class: 'system-status-icon',
            icon_size: 16
        });
        this._button.add_child(this._icon);
        
        // Add to panel
        Main.panel.addToStatusArea('nordvpn-indicator', this._button);
        
        // Build the menu
        this._buildMenu();
        
        // Update status periodically
        this._updateStatus();
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._updateStatus();
            return GLib.SOURCE_CONTINUE;
        });
        
        log('=== NordVPN Extension: Enabled successfully ===');
    }

    _buildMenu() {
        // Clear existing menu items
        this._button.menu.removeAll();
        
        // Status section
        this._statusItem = new PopupMenu.PopupMenuItem('Checking status...');
        this._button.menu.addMenuItem(this._statusItem);
        
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Quick Connect section
        const quickConnectItem = new PopupMenu.PopupMenuItem('Quick Connect');
        quickConnectItem.connect('activate', () => {
            this._quickConnect();
        });
        this._button.menu.addMenuItem(quickConnectItem);
        
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Countries submenus
        this._addCountrySubmenus();
        
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Disconnect section
        const disconnectItem = new PopupMenu.PopupMenuItem('Disconnect');
        disconnectItem.connect('activate', () => {
            this._disconnect();
        });
        this._button.menu.addMenuItem(disconnectItem);
    }

    _addCountrySubmenus() {
        const regions = {
            'Americas': [
                'United States', 'Canada', 'Brazil', 'Mexico', 'Argentina',
                'Chile', 'Costa Rica', 'Panama'
            ],
            'Europe': [
                'United Kingdom', 'Germany', 'France', 'Netherlands', 'Switzerland',
                'Sweden', 'Norway', 'Denmark', 'Finland', 'Italy', 'Spain',
                'Ireland', 'Belgium', 'Austria', 'Poland', 'Portugal',
                'Czech Republic', 'Romania', 'Hungary', 'Luxembourg', 'Iceland'
            ],
            'Asia Pacific': [
                'Japan', 'Australia', 'Singapore', 'Hong Kong', 'South Korea',
                'Taiwan', 'India', 'Vietnam', 'Thailand', 'New Zealand'
            ],
            'Other Regions': [
                'Israel', 'Turkey', 'South Africa', 'United Arab Emirates'
            ]
        };

        // Create submenu for each region
        for (const [regionName, countries] of Object.entries(regions)) {
            const regionSubmenu = new PopupMenu.PopupSubMenuMenuItem(regionName);
            
            // Add countries to this region's submenu
            countries.forEach(country => {
                const countryItem = new PopupMenu.PopupMenuItem(country);
                countryItem.connect('activate', () => {
                    this._connectToCountry(country);
                });
                regionSubmenu.menu.addMenuItem(countryItem);
            });
            
            this._button.menu.addMenuItem(regionSubmenu);
        }
    }

    _getCountries() {
        try {
            const [success, stdout, stderr] = GLib.spawn_command_line_sync('nordvpn countries');
            if (success && stdout) {
                const output = String.fromCharCode.apply(null, stdout);
                log(`NordVPN countries output: ${output}`);
                
                // Parse the tabular output
                const lines = output.split('\n');
                let countries = [];
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('---')) {
                        // Split by multiple spaces and filter valid country names
                        const parts = trimmedLine.split(/\s{2,}/);
                        for (const part of parts) {
                            const cleanPart = part.trim();
                            if (cleanPart && 
                                cleanPart.length > 2 && 
                                !cleanPart.match(/^\d+$/) &&
                                cleanPart !== 'Countries' &&
                                !cleanPart.includes('Please')
                            ) {
                                countries.push(cleanPart);
                            }
                        }
                    }
                }
                
                if (countries.length > 0) {
                    const uniqueCountries = [...new Set(countries)];
                    return uniqueCountries;
                }
            }
        } catch (e) {
            log(`Error getting countries: ${e}`);
        }
        
        // Fallback to all common countries
        return [
            'United States', 'United Kingdom', 'Germany', 'France', 'Canada',
            'Japan', 'Australia', 'Netherlands', 'Switzerland', 'Sweden',
            'Norway', 'Denmark', 'Finland', 'Italy', 'Spain', 'Brazil',
            'Singapore', 'Hong Kong', 'Ireland', 'Belgium', 'Austria',
            'Poland', 'Portugal', 'Czech Republic', 'Romania', 'Hungary',
            'Israel', 'Turkey', 'South Africa', 'Mexico', 'Argentina',
            'Chile', 'New Zealand', 'South Korea', 'Taiwan', 'India'
        ];
    }

    _quickConnect() {
        try {
            GLib.spawn_command_line_async('nordvpn connect');
            this._statusItem.label.text = 'Connecting...';
            
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                this._updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            this._statusItem.label.text = 'Connection failed';
            log(`NordVPN quick connect error: ${e}`);
        }
    }

    _updateStatus() {
        try {
            const [success, stdout, stderr] = GLib.spawn_command_line_sync('nordvpn status');
            if (success) {
                const status = String.fromCharCode.apply(null, stdout);
                if (status.includes('Status: Connected')) {
                    const countryMatch = status.match(/Country: (.+)/);
                    const cityMatch = status.match(/City: (.+)/);
                    
                    if (countryMatch && cityMatch) {
                        this._statusItem.label.text = `Connected to ${countryMatch[1]}, ${cityMatch[1]}`;
                    } else {
                        this._statusItem.label.text = 'Connected';
                    }
                } else {
                    this._statusItem.label.text = 'Disconnected';
                }
            }
        } catch (e) {
            this._statusItem.label.text = 'Error checking status';
        }
    }

    _connectToCountry(country) {
        try {
            const countryParam = country.includes(' ') ? `"${country}"` : country;
            GLib.spawn_command_line_async(`nordvpn connect ${countryParam}`);
            this._statusItem.label.text = `Connecting to ${country}...`;
            
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                this._updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            this._statusItem.label.text = 'Connection failed';
            log(`NordVPN connection error: ${e}`);
        }
    }

    _disconnect() {
        try {
            GLib.spawn_command_line_async('nordvpn disconnect');
            this._statusItem.label.text = 'Disconnecting...';
            
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this._updateStatus();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            this._statusItem.label.text = 'Disconnect failed';
            log(`NordVPN disconnect error: ${e}`);
        }
    }

    disable() {
        log('=== NordVPN Extension: Disabling ===');
        
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
        
        log('=== NordVPN Extension: Disabled ===');
    }
}
