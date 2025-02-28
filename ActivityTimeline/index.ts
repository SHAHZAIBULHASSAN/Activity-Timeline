import { IInputs, IOutputs } from "./generated/ManifestTypes";
import './css/style.css';

export class ActivityTimeline implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private activityDataset: ComponentFramework.PropertyTypes.DataSet | undefined; // Optional since it may not be initialized immediately
    private currentViewMode = "monthly"; // Default view mode
    private eventListeners: (() => void)[] = []; // Store cleanup functions for event listeners

    /**
     * Initialize the control.
     */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this.container = container;
    }

    /**
     * Update the view with new data.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.activityDataset = context.parameters.activityDataset;

        // Check if dataset is empty or required fields are missing
        if (!this.activityDataset || !this.activityDataset.sortedRecordIds || this.activityDataset.sortedRecordIds.length === 0) {
            this.container.innerHTML = "<div class='no-activities'>No activities found</div>";
            return;
        }

        // Group records based on the current view mode
        const groupedRecords = this.groupRecordsByViewMode();

        // Sort groups in descending order
        const sortedGroups = Object.keys(groupedRecords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        // Generate the calendar HTML
        const calendarHTML = `
            <div class="view-selector">
                <button id="view-monthly" ${this.currentViewMode === "monthly" ? 'disabled' : ''}>Monthly</button>
                <button id="view-weekly" ${this.currentViewMode === "weekly" ? 'disabled' : ''}>Weekly</button>
                <button id="view-yearly" ${this.currentViewMode === "yearly" ? 'disabled' : ''}>Yearly</button>
                <button id="view-daily" ${this.currentViewMode === "daily" ? 'disabled' : ''}>Daily</button>
            </div>
            <div class="calendar-container">
                <div class="scrollable-calendar">
                    ${sortedGroups.map((groupKey) => {
                        const records = groupedRecords[groupKey];
                        return `
                            <div class="calendar-group">
                                <div class="calendar-group-header" role="button" aria-expanded="false" data-group="${groupKey}">
                                    ${groupKey}
                                    <span class="toggle-icon" aria-hidden="true">▼</span>
                                </div>
                                <div class="calendar-items" data-items-for="${groupKey}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                                    ${records.map((record) => this.renderActivityItem(record)).join("")}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;

        // Render the calendar
        this.container.innerHTML = calendarHTML;

        // Add event listeners for view mode buttons and group toggles
        this.addEventListeners(context);
    }

    /**
     * Add event listeners for view mode buttons and group toggles.
     */
    private addEventListeners(context: ComponentFramework.Context<IInputs>): void {
        // View mode buttons
        const viewModes = ["monthly", "weekly", "yearly", "daily"];
        viewModes.forEach((mode) => {
            const button = document.getElementById(`view-${mode}`);
            if (button) {
                const handler = () => {
                    this.currentViewMode = mode;
                    this.updateView(context); // Re-render the view
                };
                button.addEventListener('click', handler);
                this.eventListeners.push(() => button.removeEventListener('click', handler));
            }
        });

        // Group toggle headers
        document.querySelectorAll('.calendar-group-header').forEach((header) => {
            const groupKey = header.getAttribute('data-group');
            if (!groupKey) return;

            const itemsContainer = document.querySelector(`[data-items-for="${groupKey}"]`) as HTMLElement;
            if (!itemsContainer) return;

            const handler = () => {
                const expanded = itemsContainer.style.maxHeight !== "0px";
                itemsContainer.style.maxHeight = expanded ? "0px" : `${itemsContainer.scrollHeight}px`;
                header.setAttribute('aria-expanded', String(!expanded));
                const toggleIcon = header.querySelector('.toggle-icon');
                if (toggleIcon) toggleIcon.textContent = expanded ? "▼" : "▲";
            };

            header.addEventListener('click', handler);
            this.eventListeners.push(() => header.removeEventListener('click', handler));
        });
    }

    /**
     * Group records based on the current view mode.
     */
    private groupRecordsByViewMode(): Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]> {
        if (!this.activityDataset) return {};

        const groupedRecords: Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]> = {};
        this.activityDataset.sortedRecordIds.forEach((id) => {
            const record = this.activityDataset!.records[id]; // Use non-null assertion since we checked above
            const startDate = record.getFormattedValue("scheduledstart") || "No Start Date";
            let groupKey: string;

            switch (this.currentViewMode) {
                case "monthly":
                    groupKey = this.formatMonth(startDate);
                    break;
                case "weekly":
                    groupKey = this.formatWeek(startDate);
                    break;
                case "yearly":
                    groupKey = this.formatYear(startDate);
                    break;
                case "daily":
                    groupKey = this.formatDate(startDate);
                    break;
                default:
                    groupKey = this.formatMonth(startDate);
            }

            if (!groupedRecords[groupKey]) {
                groupedRecords[groupKey] = [];
            }
            groupedRecords[groupKey].push(record);
        });
        return groupedRecords;
    }

    /**
     * Render individual activity items.
     */
    private renderActivityItem(record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord): string {
        const subject = record.getFormattedValue("subject") || "No Subject";
        const description = record.getFormattedValue("description") || "No Subject";
        const startDate = record.getFormattedValue("scheduledstart") || "No Start Date";
        const endDate = record.getFormattedValue("scheduledend") || "No End Date";

        // Safely extract and validate status code
        const statusCode = record.getFormattedValue("statuscode");
        const statusColor = typeof statusCode === "number" ? this.getStatusColor(statusCode) : "#6c757d"; // Default gray

        return `
            <div class="calendar-item" style="border-left: 4px solid ${statusColor};">
                <div class="subject">${subject}</div>
                <div class="subject">${description}</div>
                <div class="date"><strong>Start:</strong> ${startDate}, <strong>End:</strong> ${endDate}</div>
            </div>
        `;
    }

    /**
     * Helper function to assign colors based on status code.
     */
    private getStatusColor(statusCode: number): string {
        switch (statusCode) {
            case 1: // Completed
                return "#28a745"; // Green
            case 2: // In Progress
                return "#ffc107"; // Yellow
            case 3: // Canceled
                return "#dc3545"; // Red
            default:
                return "#6c757d"; // Gray (Default)
        }
    }

    /**
     * Format date as YYYY-MM-DD.
     */
    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format month as YYYY-MM.
     */
    private formatMonth(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Format year as YYYY.
     */
    private formatYear(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        return `${date.getFullYear()}`;
    }

    /**
     * Format week as YYYY-WW.
     */
    private formatWeek(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    /**
     * Validate if a date is valid.
     */
    private isValidDate(date: Date): boolean {
        return !isNaN(date.getTime());
    }

    /**
     * Get outputs (required by the interface).
     */
    public getOutputs(): IOutputs {
        return {};
    }

    /**
     * Clean up resources (required by the interface).
     */
    public destroy(): void {
        this.container.innerHTML = "";
        this.eventListeners.forEach((cleanup) => cleanup());
        this.eventListeners = [];
    }
}