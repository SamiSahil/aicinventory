const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

// Helper function to get the current access token
const getAccessToken = () => {
    return sessionStorage.getItem('google-token');
};

// Main function to fetch data from a named range
export async function getRangeData(rangeName) {
    try {
        const token = getAccessToken();
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rangeName}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Sheets API error: ${errorData.error.message}`);
        }

        const data = await response.json();
        const [headers, ...rows] = data.values;
        
        // Return empty array if there are no data rows
        if (!rows || rows.length === 0) {
            return [];
        }

        // Convert array of arrays to array of objects
        return rows.map(row => {
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index];
            });
            return rowData;
        });

    } catch (error) {
        console.error(`Error fetching range ${rangeName}:`, error);
        throw error;
    }
}

// Function to append a new row of data
export async function appendRow(rangeName, values) {
    try {
        const token = getAccessToken();
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rangeName}:append?valueInputOption=USER_ENTERED`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    values: [values], // values must be an array of arrays
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Sheets API error: ${errorData.error.message}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error appending to range ${rangeName}:`, error);
        throw error;
    }
}

// Function to update a specific row
export async function updateRow(range, values) {
     try {
        const token = getAccessToken();
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    values: [values],
                }),
            }
        );
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Sheets API error: ${errorData.error.message}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error updating range ${range}:`, error);
        throw error;
    }
}

// Function to delete a row
// Note: This requires finding the row number first. The API deletes by row index.
export async function deleteRow(sheetName, rowIndex) {
     try {
        const token = getAccessToken();
        // This is a more complex operation requiring batchUpdate
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: await getSheetId(sheetName),
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex,
                            },
                        },
                    }, ],
                }),
            }
        );
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Sheets API error: ${errorData.error.message}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error deleting row ${rowIndex} from ${sheetName}:`, error);
        throw error;
    }
}

// Helper to get the numeric ID of a sheet by its name
async function getSheetId(sheetName) {
    // This is a simplified approach; caching this result is recommended
    try {
        const token = getAccessToken();
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        if (!response.ok) throw new Error('Could not fetch sheet metadata');
        const spreadsheet = await response.json();
        const sheet = spreadsheet.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) throw new Error(`Sheet with name "${sheetName}" not found.`);
        return sheet.properties.sheetId;
    } catch(error) {
        console.error("Error getting sheet ID:", error);
        throw error;
    }
}
