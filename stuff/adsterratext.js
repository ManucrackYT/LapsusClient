module.exports = {
    banner_code: `
      <!-- Adsterra Banner Ad -->
      <script type="text/javascript">
        atOptions = {
          'key' : 'YOUR_BANNER_ZONE_ID',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300,
          'params' : {}
        };
        document.write('<scr' + 'ipt type="text/javascript" src="//www.highperformanceformat.com/YOUR_BANNER_ZONE_ID/invoke.js"></scr' + 'ipt>');
      </script>
    `,
    
    popunder_code: `
      <!-- Adsterra Popunder Ad -->
      <script type="text/javascript">
        atOptions = {
          'key' : 'YOUR_POPUNDER_ZONE_ID',
          'format' : 'iframe',
          'height' : 60,
          'width' : 468,
          'params' : {}
        };
        document.write('<scr' + 'ipt type="text/javascript" src="//www.highperformanceformat.com/YOUR_POPUNDER_ZONE_ID/invoke.js"></scr' + 'ipt>');
      </script>
    `,
    
    afk_page_code: `
      <!-- Adsterra AFK Page Integration -->
      <div id="adsterra-afk-container">
        <h3>Earn coins by watching ads</h3>
        <p>Stay on this page to earn coins automatically</p>
        <!-- Adsterra ad space can be inserted here -->
      </div>
    `
  };