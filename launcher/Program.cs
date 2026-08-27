using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace FormGeneratorApp
{
    static class Program
    {
        private const string APP_URL = "https://iskakfatoni.github.io/formGenerator-IskakFatoni/";
        private const string APP_TITLE = "formGenerator-IskakFatoni";

        [STAThread]
        static void Main()
        {
            try
            {
                string edgePath = GetEdgePath();
                if (!string.IsNullOrEmpty(edgePath))
                {
                    string userDataDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "formGenerator-IskakFatoni"
                    );

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = "--app=\"" + APP_URL + "\" --user-data-dir=\"" + userDataDir + "\" --window-size=1280,850",
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }

                string chromePath = GetChromePath();
                if (!string.IsNullOrEmpty(chromePath))
                {
                    string userDataDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "formGenerator-IskakFatoni"
                    );

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = chromePath,
                        Arguments = "--app=\"" + APP_URL + "\" --user-data-dir=\"" + userDataDir + "\" --window-size=1280,850",
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }

                // Fallback to default system browser
                Process.Start(new ProcessStartInfo
                {
                    FileName = APP_URL,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Gagal membuka formGenerator-IskakFatoni: " + ex.Message, APP_TITLE, MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        static string GetEdgePath()
        {
            string[] paths = {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };
            foreach (var p in paths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        static string GetChromePath()
        {
            string[] paths = {
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };
            foreach (var p in paths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }
    }
}
