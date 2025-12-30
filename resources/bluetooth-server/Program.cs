using InTheHand.Net;
using InTheHand.Net.Bluetooth;
using InTheHand.Net.Sockets;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace BluetoothServer
{
    class Program
    {
        static void Main(string[] args)
        {
            RunServer().GetAwaiter().GetResult();
        }

        static async Task RunServer()
        {
            LogStatus("Iniciando servidor OBEX (C# Sidecar v4)...");
            CancellationTokenSource cts = new CancellationTokenSource();

            try
            {
                if (BluetoothRadio.Default == null)
                {
                    LogError("No se encontró adaptador Bluetooth.");
                    await Task.Delay(5000);
                    return;
                }

                try
                {
                    BluetoothRadio.Default.Mode = RadioMode.Discoverable;
                    LogStatus("Modo: VISIBLE (Discoverable)");
                }
                catch { }

                var listener = new BluetoothListener(BluetoothService.ObexObjectPush);
                listener.Start();
                
                Console.WriteLine(JsonSerializer.Serialize(new { event_type = "started", hostname = BluetoothRadio.Default.Name, address = BluetoothRadio.Default.LocalAddress.ToString() }));

                // Run listener in background
                var listenerTask = Task.Run(async () => {
                    while (!cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            using var client = listener.AcceptBluetoothClient();
                            LogConnection($"Conectado: {client.RemoteMachineName}");
                            using var stream = client.GetStream();
                            await HandleObexSession(stream);
                        }
                        catch (Exception ex)
                        {
                            if (!cts.Token.IsCancellationRequested) 
                                LogError($"Error en sesión: {ex.Message}");
                        }
                    }
                }, cts.Token);

                // Main thread listens for STOP command
                while (true)
                {
                    string line = await Console.In.ReadLineAsync();
                    if (line != null && line.Trim().ToUpper() == "STOP")
                    {
                        LogStatus("Comando STOP recibido. Apagando...");
                        try {
                            // Restore invisible mode
                            if (BluetoothRadio.Default != null)
                                BluetoothRadio.Default.Mode = RadioMode.Connectable;
                        } catch {}
                        
                        cts.Cancel();
                        listener.Stop();
                        Environment.Exit(0);
                    }
                }
            }
            catch (Exception ex)
            {
                LogError($"Error FATAL: {ex.Message}");
                await Task.Delay(5000);
            }
        }

        static async Task HandleObexSession(NetworkStream stream)
        {
            // Minimal OBEX Parser
            // We expect: CONNECT -> PUT (One or more) -> DISCONNECT
            
            bool connected = false;
            string currentFile = null;
            FileStream fileStream = null;

            long totalBytes = 0;
            long bytesReceived = 0;
            DateTime lastProgressTime = DateTime.MinValue;

            try
            {
                while (true)
                {
                    // Read Header (3 bytes: OpCode + Length)
                    byte[] header = new byte[3];
                    int read = await ReadExactly(stream, header, 3);
                    if (read == 0) break; // End of stream

                    byte opCode = header[0];
                    int length = (header[1] << 8) | header[2];

                    if (length < 3) length = 3; // Safety

                    // Read logic payload
                    int payloadSize = length - 3;
                    byte[] payload = new byte[payloadSize];
                    if (payloadSize > 0)
                    {
                        await ReadExactly(stream, payload, payloadSize);
                    }

                    // --- HANDLE PACKETS ---

                    // 1. CONNECT (0x80)
                    if (opCode == 0x80)
                    {
                        // Reply SUCCESS (0xA0)
                        byte[] response = new byte[] { 0xA0, 0x00, 0x07, 0x10, 0x00, 0x20, 0x00 };
                        await stream.WriteAsync(response, 0, response.Length);
                        connected = true;
                        LogDebug("OBEX CONNECTED");
                    }
                    // 2. DISCONNECT (0x81)
                    else if (opCode == 0x81)
                    {
                        byte[] response = new byte[] { 0xA0, 0x00, 0x03 };
                        await stream.WriteAsync(response, 0, response.Length);
                        LogDebug("OBEX DISCONNECTED");
                        break;
                    }
                    // 3. PUT (0x02 = Put, 0x82 = Put Final)
                    else if (opCode == 0x02 || opCode == 0x82)
                    {
                        int index = 0;
                        
                        // If it's a new PUT (not continuation), create file
                        if (fileStream == null) 
                        {
                             currentFile = Path.Combine(Path.GetTempPath(), $"bt_{DateTime.Now.Ticks}.jpg");
                             fileStream = File.Create(currentFile);
                             totalBytes = 0; // Reset
                             bytesReceived = 0;
                        }

                        while (index < payload.Length)
                        {
                            byte hi = payload[index];
                            index++;
                            
                            // NAME (0x01)
                            if (hi == 0x01) {
                                int len = (payload[index] << 8) | payload[index+1];
                                index += 2;
                                int valLen = len - 3; 
                                if (valLen > 0) {
                                    string name = Encoding.BigEndianUnicode.GetString(payload, index, valLen).Trim('\0');
                                    string newPath = Path.Combine(Path.GetTempPath(), name);
                                    if (fileStream != null) {
                                        fileStream.Dispose();
                                        File.Move(currentFile, newPath, true);
                                        currentFile = newPath;
                                        fileStream = File.OpenWrite(currentFile);
                                        fileStream.Seek(0, SeekOrigin.End);
                                    }
                                    LogDebug($"Recibiendo: {name}");
                                }
                                index += valLen;
                            }
                            // LENGTH (0xC3) - 4 bytes
                            else if (hi == 0xC3) {
                                // 0xC3 is 4-byte int. 1(HI) + 4(Val) = 5 bytes total? 
                                // WAIT! Standard header encoding:
                                // 0xC0 mask means 4 bytes. 
                                // So headers are: HI(1) + Val(4). No explicit length field for fixed types.
                                totalBytes = (uint)((payload[index] << 24) | (payload[index+1] << 16) | (payload[index+2] << 8) | payload[index+3]);
                                index += 4;
                                LogDebug($"Tamaño total detectado: {totalBytes} bytes");
                            }
                            // BODY (0x48) or END-OF-BODY (0x49)
                            else if (hi == 0x48 || hi == 0x49) {
                                int len = (payload[index] << 8) | payload[index+1];
                                index += 2;
                                int valLen = len - 3;
                                
                                if (valLen > 0) {
                                    fileStream.Write(payload, index, valLen);
                                    bytesReceived += valLen;
                                    
                                    // Emit progress (Debounced 200ms)
                                    if (totalBytes > 0 && (DateTime.Now - lastProgressTime).TotalMilliseconds > 200) {
                                        LogProgress(bytesReceived, totalBytes);
                                        lastProgressTime = DateTime.Now;
                                    }
                                }
                                index += valLen;
                            }
                            // Other headers (skip)
                            else {
                                int type = hi & 0xC0;
                                if (type == 0x00 || type == 0x40) {
                                    int len = (payload[index] << 8) | payload[index+1];
                                    index += (len - 1); 
                                } else if (type == 0x80) {
                                    index += 1;
                                } else if (type == 0xC0) {
                                    index += 4;
                                }
                            }
                        }

                        // Response
                        if (opCode == 0x02) {
                            byte[] resp = new byte[] { 0x90, 0x00, 0x03 };
                            await stream.WriteAsync(resp, 0, resp.Length);
                        } else {
                            // Final
                            fileStream.Dispose();
                            fileStream = null;
                            
                            // Send final 100%
                            if (totalBytes > 0) LogProgress(totalBytes, totalBytes);

                            byte[] resp = new byte[] { 0xA0, 0x00, 0x03 };
                            await stream.WriteAsync(resp, 0, resp.Length);
                            
                            LogFileSaved(currentFile);
                            currentFile = null;
                        }
                    }
                    else 
                    {
                        // Unknown opcode such like SetPath (0x85) -> Fail
                        // Reply Not Implemented (0xD1) or Success (0xA0) to pretend
                        byte[] resp = new byte[] { 0xA0, 0x00, 0x03 }; 
                        await stream.WriteAsync(resp, 0, resp.Length);
                    }
                }
            }
            catch (Exception ex)
            {
               LogDebug($"Loop Error: {ex.Message}");
            }
            finally
            {
                if (fileStream != null) fileStream.Dispose();
            }
        }

        static async Task<int> ReadExactly(NetworkStream s, byte[] buff, int len) {
            int total = 0;
            while (total < len) {
                int r = await s.ReadAsync(buff, total, len - total);
                if (r == 0) return 0; // EOF
                total += r;
            }
            return total;
        }

        static void LogStatus(string msg) => PrintJson("status", msg);
        static void LogError(string msg) => PrintJson("error", msg);
        static void LogConnection(string msg) => PrintJson("connection", msg);
        static void LogDebug(string msg) => Console.Error.WriteLine($"[DEBUG] {msg}");
        
        static void LogFileSaved(string path) {
            Console.WriteLine(JsonSerializer.Serialize(new { 
                event_type = "file_saved", 
                path = path, 
                name = Path.GetFileName(path) 
            }));
        }

        static void LogProgress(long loaded, long total) {
            Console.WriteLine(JsonSerializer.Serialize(new { 
                event_type = "progress", 
                loaded = loaded, 
                total = total 
            }));
        }

        static void PrintJson(string type, string msg) {
            Console.WriteLine(JsonSerializer.Serialize(new { event_type = type, message = msg }));
        }
    }
}
